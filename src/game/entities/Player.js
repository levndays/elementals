import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { FireballAbility } from '../abilities/FireballAbility.js';
import { FirefliesAbility } from '../abilities/FirefliesAbility.js';
import { COLLISION_GROUPS } from '../../common/CollisionGroups.js';
import { Katana } from '../weapons/Katana.js';

export class Player {
    constructor(camera, world, inputManager, scene, game) {
        this.camera = camera;
        this.world = world;
        this.input = inputManager;
        this.scene = scene; // This is the viewModelScene
        this.game = game;

        // --- Core Parameters ---
        this.speed = 8;
        this.jumpHeight = 8;
        this.maxJumps = 2;
        this.spawnPoint = { x: 0, y: 10, z: 0 }; 

        // --- Health & Energy ---
        this.maxHealth = 1000;
        this.currentHealth = this.maxHealth;
        this.maxEnergy = 1000;
        this.currentEnergy = this.maxEnergy;
        this.energyRegenRate = 25;
        this.energyRegenDelay = 5;

        // --- Internal State ---
        this.isDead = false;
        this.jumpsRemaining = 0;
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.PI_2 = Math.PI / 2;
        this.isDashing = false;
        this.isSlamming = false;
        this.lastAbilityTime = -this.energyRegenDelay;
        
        // --- Targeting System ---
        this.lockedTarget = null;
        this.maxTargetingRange = 100;
        this.maxAngularDeviation = Math.tan(THREE.MathUtils.degToRad(15)); 

        // --- VFX ---
        this.originalFov = camera.fov;
        this.targetFov = this.originalFov;
        this.vfx = {
            damage: document.getElementById('screen-overlay'),
            dashForward: document.getElementById('vfx-dash-forward'),
            dashSideways: document.getElementById('vfx-dash-sideways'),
            jump: document.getElementById('vfx-jump-wind'),
            slam: document.getElementById('vfx-ground-slam'),
        };

        // --- PERFORMANCE: Reusable Objects ---
        this._targetRayOrigin = new THREE.Vector3();
        this._targetRayDirection = new THREE.Vector3();
        this._enemyPos = new THREE.Vector3();
        this._oToP = new THREE.Vector3();
        this._losRayFrom = new CANNON.Vec3();
        this._losRayTo = new CANNON.Vec3();
        this._forward = new THREE.Vector3();
        this._right = new THREE.Vector3();

        // --- Weapon & Ability Systems ---
        this.weapon = new Katana(this);
        this.abilities = [null, null, null, null];
        this.selectedAbilityIndex = 0;
        this.abilities[0] = new FireballAbility(this);
        this.abilities[1] = new FirefliesAbility(this);

        // --- Movement Mechanics ---
        this.DOUBLE_JUMP_COOLDOWN = 1.5;
        this.doubleJumpOnCooldown = false;
        this.doubleJumpCooldownTimer = this.DOUBLE_JUMP_COOLDOWN;
        this.DASH_SPEED_MULTIPLIER = 4;
        this.DASH_DURATION = 0.2;
        this.DASH_COOLDOWN = 2.0;
        this.DOUBLE_TAP_WINDOW = 300;
        this.dashOnCooldown = false;
        this.dashCooldownTimer = this.DASH_COOLDOWN;
        this.dashTimer = 0;
        this.dashDirection = new THREE.Vector3();
        this.keyLastPress = {};
        this.keyPreviousState = {};

        // --- View Model ---
        this.camera.add(this.weapon.mesh);
        this.scene.add(this.camera);


        this.createPhysicsBody();
        this.setupEventListeners();
        this.setupVFXListeners();
    }
    
    createPhysicsBody() {
        const playerShape = new CANNON.Sphere(0.8);
        const playerMaterial = new CANNON.Material("playerMaterial");
        this.body = new CANNON.Body({
            mass: 70,
            shape: playerShape,
            material: playerMaterial,
            fixedRotation: true,
            collisionFilterGroup: COLLISION_GROUPS.PLAYER,
            collisionFilterMask: COLLISION_GROUPS.WORLD | COLLISION_GROUPS.ENEMY | COLLISION_GROUPS.PROJECTILE,
        });

        const worldMaterial = this.world.defaultMaterial;
        const playerWorldContactMaterial = new CANNON.ContactMaterial(worldMaterial, playerMaterial, {
            friction: 0.1,
            restitution: 0.1,
        });
        this.world.addContactMaterial(playerWorldContactMaterial);
        this.world.addBody(this.body);
    }

    setupVFXListeners() {
        Object.values(this.vfx).forEach(element => {
            if (element) {
                element.addEventListener('animationend', () => {
                    element.classList.remove('active', 'right-to-left', 'left-to-right');
                });
            }
        });
    }

    triggerVFX(element, ...classes) {
        if (!element) return;
        // This pattern reliably restarts a CSS animation
        element.classList.remove('active', 'right-to-left', 'left-to-right');
        void element.offsetWidth; // Force reflow
        element.classList.add('active', ...classes);
    }
    
    setupEventListeners() {
        this.world.addEventListener('postStep', () => {
            if (!this.isDead) {
                this.camera.position.copy(this.body.position);
            }
        });

        this.body.addEventListener('collide', (event) => {
            const contactNormal = new CANNON.Vec3();
            if (event.contact.bi.id === this.body.id) {
                event.contact.ni.negate(contactNormal);
            } else {
                contactNormal.copy(event.contact.ni);
            }

            const isGroundContact = contactNormal.dot(CANNON.Vec3.UNIT_Y) > 0.5;

            if (isGroundContact) {
                if (this.isSlamming) {
                    this.triggerVFX(this.vfx.slam);
                    this.isSlamming = false;
                }
                this.jumpsRemaining = this.maxJumps;
                if (!this.doubleJumpOnCooldown) {
                    this.doubleJumpCooldownTimer = this.DOUBLE_JUMP_COOLDOWN;
                }
            }
        });
        
        this.game.renderer.renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('mousedown', (event) => {
            if (document.pointerLockElement) {
                if (event.button === 0) { this.weapon.attack(); } 
                else if (event.button === 2) { this.handleAbilities(true); }
            }
        });
    }
    
    spawn(position) {
        this.isDead = false;
        this.spawnPoint = { ...position };
        this.body.position.set(position.x, position.y, position.z);
        this.body.velocity.set(0, 0, 0);
        this.body.wakeUp();
        this.currentHealth = this.maxHealth;
        this.currentEnergy = this.maxEnergy;
        this.jumpsRemaining = 0;
        this.lastAbilityTime = this.world.time - this.energyRegenDelay;
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.currentHealth -= amount;
        this.triggerVFX(this.vfx.damage);
        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.die();
        }
    }

    die(isEditorClear = false) {
        if (this.isDead || isEditorClear) return;
        this.isDead = true;
        this.game.handlePlayerDeath();
    }

    updateLook() {
        this.euler.y -= this.input.mouse.movementX * 0.002;
        this.euler.x -= this.input.mouse.movementY * 0.002;
        this.euler.x = Math.max(-this.PI_2, Math.min(this.PI_2, this.euler.x));
        this.camera.quaternion.setFromEuler(this.euler);
        this.input.update();
    }
    
    handleMovementCooldowns(deltaTime) {
        if (this.doubleJumpOnCooldown) {
            this.doubleJumpCooldownTimer += deltaTime;
            if (this.doubleJumpCooldownTimer >= this.DOUBLE_JUMP_COOLDOWN) {
                this.doubleJumpOnCooldown = false;
            }
        }
        if (this.dashOnCooldown) {
            this.dashCooldownTimer += deltaTime;
            if (this.dashCooldownTimer >= this.DASH_COOLDOWN) {
                this.dashOnCooldown = false;
            }
        }
    }

    handleAbilities(shouldCast) {
        if (shouldCast) {
            const selectedAbility = this.abilities[this.selectedAbilityIndex];
            if (selectedAbility) { selectedAbility.cast(); }
        }
    }

    handleEnergyRegen(deltaTime) {
        if (this.world.time - this.lastAbilityTime > this.energyRegenDelay) {
            if (this.currentEnergy < this.maxEnergy) {
                this.currentEnergy = Math.min(this.maxEnergy, this.currentEnergy + this.energyRegenRate * deltaTime);
            }
        }
    }

    handleDash() {
        // Get camera basis vectors
        this.camera.getWorldDirection(this._forward);
        this._forward.y = 0;
        this._forward.normalize();
        this._right.crossVectors(this._forward, new THREE.Vector3(0, 1, 0)).normalize();

        // Project dash direction onto basis vectors
        const dotForward = this.dashDirection.dot(this._forward);
        const dotRight = this.dashDirection.dot(this._right);
        
        // Determine primary dash direction
        if (Math.abs(dotForward) > Math.abs(dotRight)) { // Forward or backward
            this.triggerVFX(this.vfx.dashForward);
            if (dotForward > 0) { // Forward
                this.targetFov = this.originalFov + 15;
            } else { // Backward
                this.targetFov = this.originalFov - 10;
            }
        } else { // Sideways
            if (dotRight > 0) { // Right
                this.triggerVFX(this.vfx.dashSideways, 'right-to-left');
            } else { // Left
                this.triggerVFX(this.vfx.dashSideways, 'left-to-right');
            }
        }
    }
    
    handleMovement(deltaTime) {
        const xInput = (this.input.keys['KeyD'] ? 1 : 0) - (this.input.keys['KeyA'] ? 1 : 0);
        const zInput = (this.input.keys['KeyW'] ? 1 : 0) - (this.input.keys['KeyS'] ? 1 : 0);

        this.camera.getWorldDirection(this._forward);
        this._forward.y = 0;
        this._forward.normalize();
        this._right.crossVectors(this._forward, new THREE.Vector3(0, 1, 0)).normalize();

        const moveDirection = new THREE.Vector3();
        if (zInput) { moveDirection.add(this._forward.clone().multiplyScalar(zInput)); }
        if (xInput) { moveDirection.add(this._right.clone().multiplyScalar(xInput)); }
        
        if (moveDirection.lengthSq() > 0) { moveDirection.normalize(); }

        const now = performance.now();
        ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach(key => {
            const isPressed = this.input.keys[key];
            if (isPressed && !this.keyPreviousState[key]) {
                if (now - (this.keyLastPress[key] || 0) < this.DOUBLE_TAP_WINDOW) {
                    if (!this.dashOnCooldown && !this.isDashing) {
                        this.isDashing = true;
                        this.dashOnCooldown = true;
                        this.dashTimer = 0;
                        this.dashCooldownTimer = 0;
                        this.dashDirection.copy(moveDirection).normalize();
                        this.handleDash();
                    }
                }
                this.keyLastPress[key] = now;
            }
            this.keyPreviousState[key] = isPressed;
        });

        if (this.isDashing) {
            this.dashTimer += deltaTime;
            const dashSpeed = this.speed * this.DASH_SPEED_MULTIPLIER;
            this.body.velocity.x = this.dashDirection.x * dashSpeed;
            this.body.velocity.z = this.dashDirection.z * dashSpeed;
            if (this.dashTimer >= this.DASH_DURATION) {
                this.isDashing = false;
            }
        } else {
            this.body.velocity.x = moveDirection.x * this.speed;
            this.body.velocity.z = moveDirection.z * this.speed;
        }

        if (this.input.keys['Space']) {
            if (this.jumpsRemaining > 0) {
                const performJump = () => {
                    this.body.velocity.y = this.jumpHeight;
                    this.jumpsRemaining--;
                    this.triggerVFX(this.vfx.jump);
                };
                if (this.jumpsRemaining === 1 && this.maxJumps === 2) {
                    if (!this.doubleJumpOnCooldown) {
                        this.doubleJumpOnCooldown = true;
                        this.doubleJumpCooldownTimer = 0;
                        performJump();
                    }
                } else {
                    performJump();
                }
            }
            this.input.keys['Space'] = false;
        }

        if (this.input.keys['ShiftLeft']) {
            if (this.jumpsRemaining < this.maxJumps && !this.isSlamming) {
                this.isSlamming = true;
                this.body.velocity.y = -25;
            }
        }
    }

    updateTargetingLogic() {
        this.camera.getWorldPosition(this._targetRayOrigin);
        this.camera.getWorldDirection(this._targetRayDirection);

        let bestEnemy = null;
        let minScore = Infinity;

        for (const enemy of this.game.enemies) { 
            if (enemy.isDead || !enemy.body || !enemy.mesh) continue;
            this._enemyPos.copy(enemy.body.position);
            const enemyHeight = enemy.mesh.geometry?.parameters?.height || 2;
            this._enemyPos.y += enemyHeight / 2;
            const distanceToEnemy = this._targetRayOrigin.distanceTo(this._enemyPos);
            if (distanceToEnemy > this.maxTargetingRange) continue;
            this._oToP.subVectors(this._enemyPos, this._targetRayOrigin).normalize();
            const dotProduct = this._oToP.dot(this._targetRayDirection);
            const angle = Math.acos(Math.min(1, Math.max(-1, dotProduct)));
            const angularDeviation = Math.tan(angle);
            if (angularDeviation < this.maxAngularDeviation) {
                this._losRayFrom.copy(this._targetRayOrigin);
                this._losRayTo.copy(this._enemyPos);
                const hasLineOfSight = !this.world.raycastClosest(
                    this._losRayFrom, this._losRayTo, { collisionFilterMask: COLLISION_GROUPS.WORLD, skipBackfaces: true }
                );
                if (hasLineOfSight) {
                    const score = (angularDeviation * angularDeviation * 100) + distanceToEnemy; 
                    if (score < minScore) {
                        minScore = score;
                        bestEnemy = enemy;
                    }
                }
            }
        }
        this.lockedTarget = bestEnemy;
    }
    
    updateVFX(deltaTime) {
        // FOV Lerping
        if (Math.abs(this.camera.fov - this.targetFov) > 0.01) {
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, deltaTime * 10);
            this.camera.updateProjectionMatrix();
        }
        
        // Return to normal FOV after a dash
        if (!this.isDashing && this.targetFov !== this.originalFov) {
            this.targetFov = this.originalFov;
        }
    }

    update(deltaTime) {
        if (this.isDead) return;

        if (document.pointerLockElement) { this.updateLook(); }

        this.handleMovementCooldowns(deltaTime);
        this.handleEnergyRegen(deltaTime);
        this.handleMovement(deltaTime);
        this.updateTargetingLogic();
        this.weapon.update(deltaTime);
        this.updateVFX(deltaTime);

        for (const ability of this.abilities) {
            if (ability) { ability.update(deltaTime); }
        }

        for (let i = 1; i <= 4; i++) {
            if (this.input.keys[`Digit${i}`]) {
                this.selectedAbilityIndex = i - 1;
            }
        }
    }
}