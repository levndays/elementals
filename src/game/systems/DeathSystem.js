// ~ src/game/systems/DeathSystem.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const DEATH_DURATION = 2.5; // seconds

/**
 * Manages the death sequence for entities, providing a more visually
 * appealing effect than immediate removal.
 */
export class DeathSystem {
    constructor() {
        this.dyingEntities = new Map(); // Map<entity, { timer: number }>
    }

    /**
     * @param {import('../world/World.js').World} world
     * @param {number} deltaTime
     */
    update(world, deltaTime) {
        // Find newly dead NPCs and start their death sequence
        for (const npc of world.getNPCs()) {
            if (npc.isDead && !this.dyingEntities.has(npc)) {
                this.startDeathSequence(npc);
            }
        }

        // Update ongoing death sequences
        for (const [entity, state] of this.dyingEntities.entries()) {
            state.timer -= deltaTime;
            
            this.updateFadeOut(entity, state.timer);

            if (state.timer <= 0) {
                world.remove(entity);
                this.dyingEntities.delete(entity);
            }
        }
    }

    /**
     * Initiates the death sequence for an NPC.
     * @param {import('../entities/NPC.js').NPC} npc
     */
    startDeathSequence(npc) {
        this.dyingEntities.set(npc, { timer: DEATH_DURATION });
        
        if (npc.physics?.body) {
            const body = npc.physics.body;
            // Make it a ragdoll
            body.fixedRotation = false;
            body.updateMassProperties();

            // Give it a little push for a dynamic fall
            const impulse = new CANNON.Vec3(
                (Math.random() - 0.5) * 100,
                Math.random() * 150,
                (Math.random() - 0.5) * 100
            );
            const point = new CANNON.Vec3(0, 0.5, 0);
            body.applyImpulse(impulse, point);
        }

        // Prepare material for fading
        if (npc.mesh?.material) {
            npc.mesh.material.transparent = true;
        }
    }

    /**
     * Updates the opacity of an entity's mesh to create a fade-out effect.
     * @param {object} entity
     * @param {number} timer
     */
    updateFadeOut(entity, timer) {
        if (entity.mesh?.material) {
            const opacity = Math.max(0, timer / DEATH_DURATION);
            entity.mesh.material.opacity = opacity;
        }
    }
}