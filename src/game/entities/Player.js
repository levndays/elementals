 import * as THREE from 'three';
    import * as CANNON from 'cannon-es';
    import { HealthComponent } from '../components/HealthComponent.js';
    import { PlayerInputComponent } from '../components/PlayerInputComponent.js';
    import { PhysicsBodyComponent } from '../components/PhysicsBodyComponent.js';
    import { AbilityLoadoutComponent } from '../components/AbilityLoadoutComponent.js';
    import { StatusEffectComponent } from '../components/StatusEffectComponent.js';
    import { GAME_CONFIG } from '../../shared/config.js';
    import { AbilityFactory } from '../abilities/AbilityFactory.js';
    import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';
    
    /**
     * Encapsulates the player entity's state, components, and core logic.
     */
    export class Player {
        constructor(world, camera, weapon, body) {
            this.id = THREE.MathUtils.generateUUID();
            this.type = 'player';
            this.world = world;
            this.camera = camera;
            this.weapon = weapon;
            if (this.weapon) this.weapon.wielder = this;
            
            this.health = new HealthComponent(GAME_CONFIG.PLAYER.MAX_HEALTH);
            this.input = new PlayerInputComponent();
            this.physics = new PhysicsBodyComponent(body);
            this.abilities = new AbilityLoadoutComponent();
            this.statusEffects = new StatusEffectComponent();
            
            this.jumpsRemaining = 0;
            this.isSlamming = false;
            this.isDead = true;
            this.lockedTarget = null;
            this.doubleJumpOnCooldown = false;
            this.doubleJumpCooldownTimer = GAME_CONFIG.PLAYER.DOUBLE_JUMP_COOLDOWN;
            this.isDashing = false;
            this.dashOnCooldown = false;
            this.dashCooldownTimer = GAME_CONFIG.PLAYER.DASH_COOLDOWN;
            this.dashStateTimer = 0;
            this.dashDirection = new THREE.Vector3();
            this.targetFov = GAME_CONFIG.PLAYER.FOV;
    
            if (!body.userData) body.userData = {};
            body.userData.entity = this;
            
            this.physics.body.addEventListener('collide', (e) => this.onCollide(e));
        }
    
        onCollide(event) {
            const otherBody = event.body;
            if (otherBody.collisionFilterGroup & COLLISION_GROUPS.WORLD) {
                const contactNormal = new CANNON.Vec3();
                if (event.contact.bi.id === this.physics.body.id) event.contact.ni.negate(contactNormal);
                else contactNormal.copy(event.contact.ni);
    
                if (contactNormal.dot(CANNON.Vec3.UNIT_Y) > 0.5) {
                    if (this.isSlamming) {
                        this.isSlamming = false;
                        this.world.emit('playerGroundSlammed');
                    }
                    this.jumpsRemaining = GAME_CONFIG.PLAYER.MAX_JUMPS;
                    if (!this.doubleJumpOnCooldown) {
                        this.doubleJumpCooldownTimer = GAME_CONFIG.PLAYER.DOUBLE_JUMP_COOLDOWN;
                    }
                }
            }
        }
    
        setMoveDirection(direction) { this.input.moveDirection.copy(direction); }
        setLookDirection(euler) { this.input.lookDirection.setFromEuler(euler); }
        
        jump() {
            if (this.statusEffects.has('stonePlating')) {
                // Allow first jump from the ground, but not subsequent (double) jumps.
                if (this.jumpsRemaining < GAME_CONFIG.PLAYER.MAX_JUMPS) {
                    return; // Block double jump
                }
            }
            this.input.jumpRequested = true;
        }
        
        dash(direction) {
            if (this.statusEffects.has('stonePlating') || this.dashOnCooldown) return;
            this.input.dashRequested = true;
            this.dashDirection.copy(direction);
        }
        
        reloadWeapon() {
            if (this.weapon && typeof this.weapon.reload === 'function') {
                this.weapon.reload();
            }
        }
    
        inspectWeapon() {
            if (this.weapon && typeof this.weapon.inspect === 'function') {
                this.weapon.inspect();
            }
        }
    
        requestSlam(isSlamming) { this.input.slamRequested = this.input.slamHeld = isSlamming; }
        selectAbility(index) { if (index >= 0 && index < this.abilities.abilities.length) this.abilities.selectedAbilityIndex = index; }
        useSelectedAbility() { const ability = this.abilities.abilities[this.abilities.selectedAbilityIndex]; if (ability) ability.cast(); }
    
        cycleAbility(direction) {
            const numAbilities = this.abilities.abilities.length;
            if (numAbilities === 0) return;
    
            let currentIndex = this.abilities.selectedAbilityIndex;
            // The modulo trick handles wrapping around in both directions.
            // Adding numAbilities before taking the modulo ensures the result is always positive.
            const newIndex = (currentIndex + direction + numAbilities) % numAbilities;
            this.selectAbility(newIndex);
        }
    
        applyLoadout(loadoutData) {
            // Ensure loadoutData is an object and has a 'cards' array property.
            const cardIds = (loadoutData && Array.isArray(loadoutData.cards)) 
                ? loadoutData.cards 
                : [null, null, null, null]; // Default to empty slots if data is malformed.
            
            this.abilities.abilities = cardIds.map(cardId => 
                cardId ? AbilityFactory.create(cardId, this) : null
            );
        }
    
        takeDamage(amount) {
            if (this.isDead || (this.world.game && this.world.game.debugModeActive)) return;
            
            let finalAmount = amount;
            if (this.statusEffects.has('stonePlating')) {
                const buff = this.statusEffects.get('stonePlating');
                finalAmount *= (1 - buff.properties.damageReduction);
            }
    
            this.health.currentHealth -= finalAmount;
            this.world.emit('entityTookDamage', { entity: this, amount: finalAmount });
            if (this.health.currentHealth <= 0) {
                this.health.currentHealth = 0;
                this.die();
            }
        }
    
        die() { if (!this.isDead) { this.isDead = true; this.world.emit('playerDied'); } }
    
        reset(spawnPosition) {
            this.health.currentHealth = this.health.maxHealth;
            this.abilities.currentEnergy = this.abilities.maxEnergy;
            this.isDead = false; this.isSlamming = false; this.isDashing = false; this.lockedTarget = null;
            this.jumpsRemaining = 0;
            this.doubleJumpOnCooldown = false; this.doubleJumpCooldownTimer = GAME_CONFIG.PLAYER.DOUBLE_JUMP_COOLDOWN;
            this.dashOnCooldown = false; this.dashCooldownTimer = GAME_CONFIG.PLAYER.DASH_COOLDOWN;
            this.dashStateTimer = 0;
            this.abilities.abilities.forEach(a => { if(a) a.cooldownTimer = a.cooldown; });
            this.abilities.lastAbilityTime = -Infinity;
            this.statusEffects.activeEffects.clear();
            
            this.physics.body.position.copy(spawnPosition);
            this.physics.body.velocity.set(0, 0, 0);
            this.physics.body.angularVelocity.set(0, 0, 0);
            this.physics.body.wakeUp();
        }
        
        spawn(spawnPosition) { this.reset(spawnPosition); }
    }