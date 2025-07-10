// src/game/entities/NPC.js
import * as THREE from 'three';
import { HealthComponent } from '../components/HealthComponent.js';
import { AIComponent } from '../components/AIComponent.js';
import { PhysicsBodyComponent } from '../components/PhysicsBodyComponent.js';
import { StatusEffectComponent } from '../components/StatusEffectComponent.js';
import { GAME_CONFIG } from '../../shared/config.js';

/**
 * Encapsulates a generic Non-Player Character entity's state and components.
 */
export class NPC {
    constructor(world, body, mesh, definition) {
        this.id = THREE.MathUtils.generateUUID();
        this.type = 'npc';
        this.world = world;
        this.name = definition.name || 'NPC';
        this.mesh = mesh;
        this.definition = definition;
        
        // NPC-specific properties from definition
        this.team = definition.team || 'enemy';
        this.attackType = definition.attackType || 'ranged';

        // Components
        this.health = new HealthComponent(GAME_CONFIG.NPC.BASE.MAX_HEALTH);
        this.ai = new AIComponent();
        this.physics = new PhysicsBodyComponent(body);
        this.statusEffects = new StatusEffectComponent();

        // Animation state
        this.mixer = null;
        this.animations = new Map(); // name -> AnimationClip
        this.activeAction = null;
        this.isAttackingAnimation = false;

        // Ragdoll state
        this.ragdoll = {
            bodies: [],
            constraints: [],
            bodyBoneMap: new Map(), // Map<CANNON.Body, THREE.Bone>
        };

        // Client-side visual state
        this.originalEmissive = new THREE.Color(0x000000); // Updated in prefab
        this.originalColor = new THREE.Color(0xffffff); // Updated in prefab
        this.isDead = false;
        
        // Water interaction state
        this.isInWater = false;
        this.currentWaterVolume = null;

        // Link back to entity for easy access from physics/rendering
        const gameEntityLink = { type: 'NPC', entity: this };
        this.userData = { gameEntity: gameEntityLink };
        mesh.userData.gameEntity = gameEntityLink;
        if (!body.userData) body.userData = {};
        body.userData.entity = this; // Use consistent .entity property for collisions
    }
    
    takeDamage(amount, impulse = null, hitPoint = null) {
        if (this.isDead) return;

        this.health.currentHealth -= amount;
        this.world.emit('entityTookDamage', { entity: this, amount });

        if (this.health.currentHealth <= 0) {
            this.health.currentHealth = 0;
            this.die(impulse, hitPoint);
        }
    }

    die(killingImpulse, hitPoint) {
        if (this.isDead) return;
        this.isDead = true;
        this.world.emit('npcDied', { entity: this, killingImpulse, hitPoint });
    }

    dispose() {
        if (this.physics.body) {
            this.physics.body.userData.entity = null;
            this.world.physics.queueForRemoval(this.physics.body);
            this.physics.body = null;
        }
        if (this.ragdoll.bodies.length > 0) {
            this.ragdoll.bodies.forEach(body => this.world.physics.queueForRemoval(body));
            this.ragdoll.constraints.forEach(constraint => this.world.physics.world.removeConstraint(constraint));
        }
        if (this.mesh) {
            this.world.scene.remove(this.mesh);
            this.mesh.traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
            this.mesh = null;
        }
        if (this.mixer) {
            this.mixer.stopAllAction();
        }
    }
}