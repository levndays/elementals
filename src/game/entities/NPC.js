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

        // Client-side visual state
        this.originalEmissive = new THREE.Color(mesh.material.emissive.getHex());
        this.isDead = false;
        this.isInWater = false; // For water interaction logic

        // Link back to entity for easy access from physics/rendering
        const gameEntityLink = { type: 'NPC', entity: this };
        this.userData = { gameEntity: gameEntityLink };
        mesh.userData.gameEntity = gameEntityLink;
        if (!body.userData) body.userData = {};
        body.userData.entity = this; // Use consistent .entity property for collisions
    }
    
    takeDamage(amount) {
        if (this.isDead) return;

        this.health.currentHealth -= amount;
        this.world.emit('entityTookDamage', { entity: this, amount });

        if (this.health.currentHealth <= 0) {
            this.health.currentHealth = 0;
            this.die();
        }
    }

    die() {
        if (this.isDead) return;
        this.isDead = true;
        this.world.emit('npcDied', { entity: this });
    }

    dispose() {
        if (this.physics.body) {
            this.physics.body.userData.entity = null;
            this.world.physics.queueForRemoval(this.physics.body);
            this.physics.body = null;
        }
        if (this.mesh) {
            this.mesh.userData.entity = null;
            this.mesh.geometry?.dispose();
            if (this.mesh.material.dispose) {
                this.mesh.material.dispose();
            }
            this.world.scene.remove(this.mesh);
            this.mesh = null;
        }
    }
}