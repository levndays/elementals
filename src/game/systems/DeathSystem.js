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
        // Find newly dead enemies and start their death sequence
        for (const enemy of world.getEnemies()) {
            if (enemy.isDead && !this.dyingEntities.has(enemy)) {
                this.startDeathSequence(enemy);
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
     * Initiates the death sequence for an enemy.
     * @param {import('../entities/Enemy.js').Enemy} enemy
     */
    startDeathSequence(enemy) {
        this.dyingEntities.set(enemy, { timer: DEATH_DURATION });
        
        if (enemy.physics?.body) {
            const body = enemy.physics.body;
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
        if (enemy.mesh?.material) {
            enemy.mesh.material.transparent = true;
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