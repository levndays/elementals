import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { HealthBar } from '../ui/HealthBar.js';
import { COLLISION_GROUPS } from '../../common/CollisionGroups.js';
import { EnemyProjectile } from '../abilities/EnemyProjectile.js';
import { DamageNumber } from '../ui/DamageNumber.js';

export class Enemy {
    constructor({ game, name = 'Dummy' }) {
        this.game = game;
        this.scene = game.renderer.scene;
        this.world = game.physics.world;
        this.name = name;
        
        // --- Core Parameters ---
        this.maxHealth = 500;
        this.currentHealth = this.maxHealth;
        this.speed = 8;
        this.isDead = false;

        // --- Hit Feedback ---
        this.flashDuration = 0.15;
        this.flashTimer = 0;
        this.originalEmissive = null; // Will be set after mesh creation

        // --- AI State & Parameters ---
        this.state = 'IDLE'; // IDLE, SEARCHING, COMBAT
        this.lastKnownPlayerPosition = new THREE.Vector3();
        this.perception = {
            detectionRange: 40,
            loseSightRange: 50,
            attackRange: 30,
            optimalRange: 22,
            minimumRange: 10,
            hasLineOfSight: false,
            distanceToPlayer: Infinity,
        };
        
        // --- PERFORMANCE: AI Throttling ---
        // Stagger AI updates to prevent all enemies from running heavy logic on the same frame.
        this.AI_UPDATE_INTERVAL = 0.1; // Update AI logic 10 times per second
        this.aiUpdateTimer = Math.random() * this.AI_UPDATE_INTERVAL; // Random initial offset

        // --- PERFORMANCE: Reusable Objects to prevent GC churn ---
        this._perceptionRayFrom = new CANNON.Vec3();
        this._perceptionRayTo = new CANNON.Vec3();
        this._lookAtTarget = new THREE.Vector3();
        this._tempQuaternion = new CANNON.Quaternion();
        this._tempObject3D = new THREE.Object3D();

        // --- Combat & Movement Abilities ---
        this.strafeDirection = 1;
        this.strafeDirectionTimer = 0;
        this.turnSpeed = 0.1;
        this.jumpHeight = 8;
        this.jumpCooldown = 2.0;
        this.jumpTimer = this.jumpCooldown;

        this.dashSpeed = 32;
        this.dashDuration = 0.2;
        this.dashCooldown = 2.0;
        this.dashTimer = this.dashCooldown;
        this.isDashing = false;
        this.dashStateTimer = 0;
        this.dashDirection = new THREE.Vector3();
        
        this.attackCooldown = 1.5;
        this.attackTimer = this.attackCooldown;

        this.createMesh();
        this.createPhysicsBody();
        
        if (this.game.player) {
            this.healthBar = new HealthBar(this);
        } else {
            this.healthBar = null;
        }
        
        this.game.updatables.push(this);
    }
    
    createMesh() {
        const geometry = new THREE.CapsuleGeometry(0.7, 1.0, 4, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x990000, roughness: 0.4 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        // Store original material state for hit flash
        this.originalEmissive = new THREE.Color(this.mesh.material.emissive.getHex());
    }

    createPhysicsBody() {
        const shape = new CANNON.Sphere(0.8);
        this.body = new CANNON.Body({
            mass: 80,
            shape,
            fixedRotation: true,
            collisionFilterGroup: COLLISION_GROUPS.ENEMY,
            collisionFilterMask: COLLISION_GROUPS.WORLD | COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.ENEMY,
        });
        this.world.addBody(this.body);
    }

    spawn(position) {
        this.body.position.set(position.x, position.y, position.z);
        this.body.velocity.set(0, 0, 0);
        this.currentHealth = this.maxHealth;
        this.isDead = false;
        if (this.healthBar) {
            this.healthBar.updateHealth(this.currentHealth, this.maxHealth);
            this.healthBar.setVisible(true);
        }
        this.body.type = CANNON.Body.DYNAMIC;
        this.lastKnownPlayerPosition.copy(position);
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.currentHealth -= amount;

        // --- Hit Feedback ---
        // 1. Flash effect
        this.mesh.material.emissive.setHex(0xffffff);
        this.flashTimer = this.flashDuration;
        // 2. Floating damage number
        new DamageNumber({
            game: this.game,
            position: new THREE.Vector3().copy(this.body.position).add(new THREE.Vector3(0, 1.5, 0)),
            text: `${Math.floor(amount)}`
        });
        // --- End Hit Feedback ---

        if (this.healthBar) {
            this.healthBar.updateHealth(this.currentHealth, this.maxHealth);
        }
        if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.die();
        }
    }

    die(isEditorClear = false) {
        if (this.isDead) return;
        this.isDead = true;
    
        if (!isEditorClear) {
            this.game.onEnemyKilled();
        }
    
        if (this.healthBar) {
            this.healthBar.setVisible(false);
            this.healthBar.dispose();
        }
        
        if (this.body) this.game.physics.queueForRemoval(this.body);
        
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
    
        const enemyIndex = this.game.enemies.indexOf(this);
        if (enemyIndex > -1) {
            this.game.enemies.splice(enemyIndex, 1);
        }
        
        const updatableIndex = this.game.updatables.indexOf(this);
        if (updatableIndex > -1) {
            this.game.updatables.splice(updatableIndex, 1);
        }
    }

    update(deltaTime) {
        if (this.isDead) return;

        // Handle hit flash
        if (this.flashTimer > 0) {
            this.flashTimer -= deltaTime;
            const flashProgress = 1 - Math.max(0, this.flashTimer / this.flashDuration);
            this.mesh.material.emissive.lerpColors(new THREE.Color(0xffffff), this.originalEmissive, flashProgress);
            if (this.flashTimer <= 0) {
                this.mesh.material.emissive.copy(this.originalEmissive);
            }
        }

        if (this.game.player) {
            this.updateTimers(deltaTime);
            
            // --- PERFORMANCE: AI Throttling ---
            this.aiUpdateTimer += deltaTime;
            if (this.aiUpdateTimer >= this.AI_UPDATE_INTERVAL) {
                this.runAI(deltaTime);
                this.aiUpdateTimer = 0;
            }
        }

        // Only update movement/physics every frame if not dashing
        if (!this.isDashing && this.state !== 'IDLE') {
             this.applyMovementBasedOnState();
        }
        
        if (this.body && this.mesh) {
            this.mesh.position.copy(this.body.position);
            this.mesh.quaternion.copy(this.body.quaternion);
        }
    }

    updateTimers(deltaTime) {
        this.jumpTimer += deltaTime;
        this.dashTimer += deltaTime;
        this.attackTimer += deltaTime;
        this.strafeDirectionTimer -= deltaTime;
        if(this.isDashing) this.dashStateTimer += deltaTime;
    }

    // This runs less frequently due to throttling
    runAI(deltaTime) {
        this.updatePerception();
        this.updateState();
        this.executeStateActions(deltaTime);
    }

    updatePerception() {
        const player = this.game.player;
        if (!player || !player.body) return;
        this.perception.distanceToPlayer = this.body.position.distanceTo(player.body.position);
        
        this._perceptionRayFrom.copy(this.body.position);
        this._perceptionRayTo.copy(player.body.position);
        this.perception.hasLineOfSight = !this.world.raycastClosest(
            this._perceptionRayFrom, this._perceptionRayTo, { collisionFilterMask: COLLISION_GROUPS.WORLD, skipBackfaces: true }
        );
        if (this.perception.hasLineOfSight) {
            this.lastKnownPlayerPosition.copy(player.body.position);
        }
    }

    updateState() {
        if (this.perception.hasLineOfSight && this.perception.distanceToPlayer < this.perception.detectionRange) {
            this.state = 'COMBAT';
        } else if (this.state === 'COMBAT' && this.perception.distanceToPlayer > this.perception.loseSightRange) {
            this.state = 'SEARCHING';
        } else if (this.state === 'SEARCHING' && this.body.position.distanceTo(this.lastKnownPlayerPosition) < 2) {
            this.state = 'IDLE';
        }
    }

    // This handles actions based on the current state. It's called by the throttled runAI.
    executeStateActions(deltaTime) {
        if (this.isDashing) {
            if (this.dashStateTimer >= this.dashDuration) this.isDashing = false;
            return;
        }

        this.faceTarget(this.lastKnownPlayerPosition);

        if (this.state === 'COMBAT') {
            this.handleCombatDecisions();
        }
    }
    
    // This is called every frame to apply velocity based on the AI's decided state.
    applyMovementBasedOnState() {
        this.body.wakeUp();

        switch (this.state) {
            case 'IDLE':
                this.body.velocity.x *= 0.9; this.body.velocity.z *= 0.9;
                break;
            case 'SEARCHING':
                const searchDir = new CANNON.Vec3().copy(this.lastKnownPlayerPosition).vsub(this.body.position);
                searchDir.y = 0;
                searchDir.normalize();
                this.body.velocity.x = searchDir.x * this.speed;
                this.body.velocity.z = searchDir.z * this.speed;
                break;
            case 'COMBAT':
                this.repositionDuringCombat();
                break;
        }
    }
    
    handleCombatDecisions() {
        const { distanceToPlayer, hasLineOfSight, attackRange } = this.perception;
        const canShoot = hasLineOfSight && this.attackTimer >= this.attackCooldown;
        const toPlayerDir = new CANNON.Vec3().copy(this.lastKnownPlayerPosition).vsub(this.body.position);
        toPlayerDir.y = 0;

        if (canShoot && distanceToPlayer <= attackRange) {
            this.shoot();
        }

        this.navigateObstacles();
        if (this.dashTimer >= this.dashCooldown && Math.random() < 0.2) { // Increased chance due to less frequent checks
            const right = new THREE.Vector3().crossVectors(toPlayerDir, new THREE.Vector3(0,1,0)).normalize();
            right.multiplyScalar(Math.random() > 0.5 ? 1 : -1);
            this.dash(right);
        }
    }

    repositionDuringCombat() {
        const { distanceToPlayer, optimalRange, minimumRange } = this.perception;
        const toPlayerDir = new CANNON.Vec3().copy(this.lastKnownPlayerPosition).vsub(this.body.position);
        toPlayerDir.y = 0;
        if (toPlayerDir.lengthSquared() > 0) toPlayerDir.normalize();

        if (this.attackTimer < this.attackCooldown / 2) { // Pause briefly after shooting
             this.body.velocity.x *= 0.8;
             this.body.velocity.z *= 0.8;
             return;
        }

        if (distanceToPlayer > optimalRange) {
            this.body.velocity.x = toPlayerDir.x * this.speed;
            this.body.velocity.z = toPlayerDir.z * this.speed;
        } else if (distanceToPlayer < minimumRange) {
            this.body.velocity.x = -toPlayerDir.x * this.speed * 0.8;
            this.body.velocity.z = -toPlayerDir.z * this.speed * 0.8;
        } else {
            if (this.strafeDirectionTimer <= 0) {
                this.strafeDirection = Math.random() > 0.5 ? 1 : -1;
                this.strafeDirectionTimer = Math.random() * 2 + 1.5;
            }
            const rightDir = new CANNON.Vec3(toPlayerDir.z, 0, -toPlayerDir.x);
            this.body.velocity.x = rightDir.x * this.speed * 0.7 * this.strafeDirection;
            this.body.velocity.z = rightDir.z * this.speed * 0.7 * this.strafeDirection;
        }
    }

    faceTarget(targetPosition) {
        this._lookAtTarget.copy(targetPosition);
        this._lookAtTarget.y = this.body.position.y;
        this._tempObject3D.position.copy(this.body.position);
        this._tempObject3D.lookAt(this._lookAtTarget);
        this._tempQuaternion.copy(this._tempObject3D.quaternion);
        this.body.quaternion.slerp(this._tempQuaternion, this.turnSpeed, this.body.quaternion);
    }
    
    navigateObstacles() {
        if (this.body.velocity.lengthSquared() < 0.1) return;

        const moveDirection = new CANNON.Vec3().copy(this.body.velocity);
        moveDirection.normalize();

        const rayFrom = new CANNON.Vec3().copy(this.body.position);
        const rayTo = rayFrom.clone().vadd(moveDirection.scale(2));
        
        if (this.world.raycastClosest(rayFrom, rayTo, { collisionFilterMask: COLLISION_GROUPS.WORLD }, new CANNON.RaycastResult())) {
            if (this.jumpTimer >= this.jumpCooldown) this.jump();
        }
    }
    
    jump() {
        const rayFrom = new CANNON.Vec3().copy(this.body.position);
        const rayTo = rayFrom.clone().vadd(new CANNON.Vec3(0, -1.1, 0));
        if (this.world.raycastClosest(rayFrom, rayTo, {collisionFilterMask: COLLISION_GROUPS.WORLD}, new CANNON.RaycastResult())) {
             this.body.velocity.y = this.jumpHeight;
             this.jumpTimer = 0;
        }
    }

    dash(direction) {
        this.isDashing = true;
        this.dashTimer = 0;
        this.dashStateTimer = 0;
        this.dashDirection.copy(direction).normalize();
        this.dashDirection.y = 0;
        this.dashDirection.normalize();
        this.body.velocity.x = this.dashDirection.x * this.dashSpeed;
        this.body.velocity.y = 0;
        this.body.velocity.z = this.dashDirection.z * this.dashSpeed;
    }

    calculateBallisticLaunchVelocity(startPos, targetPos, projectileSpeed, gravity) {
        const delta = new THREE.Vector3().subVectors(targetPos, startPos);
        const deltaXZ = new THREE.Vector2(delta.x, delta.z);
        const distXZ = deltaXZ.length();
        const v = projectileSpeed, g = gravity, y = delta.y, x = distXZ;
        const discriminant = v**4 - g * (g * x**2 + 2 * y * v**2);
        if (discriminant < 0) return null;
        const angle = Math.atan2(v**2 - Math.sqrt(discriminant), g * x);
        const Vy = v * Math.sin(angle);
        const Vxz = v * Math.cos(angle);
        const dirXZ = deltaXZ.normalize();
        return new THREE.Vector3(dirXZ.x * Vxz, Vy, dirXZ.y * Vxz);
    }

    shoot() {
        this.attackTimer = 0;
        const projectileSpeed = 40;
        const timeToTarget = this.perception.distanceToPlayer / projectileSpeed;
        const playerVelocity = new CANNON.Vec3().copy(this.game.player.body.velocity);
        const predictionTime = Math.min(timeToTarget, 1.0);
        const predictedPosition = new THREE.Vector3().copy(this.lastKnownPlayerPosition).add(
            new THREE.Vector3().copy(playerVelocity).multiplyScalar(predictionTime)
        );
        predictedPosition.y += 0.5;

        const casterPosition = new THREE.Vector3().copy(this.body.position);
        const gravityMagnitude = Math.abs(this.world.gravity.y);
        let launchVelocity = this.calculateBallisticLaunchVelocity(
            casterPosition, predictedPosition, projectileSpeed, gravityMagnitude
        );
        
        if (!launchVelocity) {
            launchVelocity = new THREE.Vector3().subVectors(predictedPosition, casterPosition).normalize().multiplyScalar(projectileSpeed);
        }

        new EnemyProjectile({ caster: this, initialVelocity: launchVelocity });
    }
}