// src/game/systems/DeathSystem.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const DEATH_DURATION = 5.0; // seconds, increased for ragdolls

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
        world.on('npcDied', ({ entity, killingImpulse, hitPoint }) => {
            if (entity.isDead && !this.dyingEntities.has(entity)) {
                this.startDeathSequence(world, entity, killingImpulse, hitPoint);
            }
        });

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
     * @param {import('../world/World.js').World} world
     * @param {import('../entities/NPC.js').NPC} npc
     * @param {CANNON.Vec3} [killingImpulse]
     * @param {CANNON.Vec3} [hitPoint]
     */
    startDeathSequence(world, npc, killingImpulse, hitPoint) {
        this.dyingEntities.set(npc, { timer: DEATH_DURATION });
        
        // --- Ragdoll Activation ---
        if (npc.ragdoll?.bodies.length > 0) {
            // Remove the main collider
            world.physics.queueForRemoval(npc.physics.body);
            npc.physics.body = null;
            
            // Add ragdoll bodies and constraints to the world
            npc.ragdoll.bodies.forEach(body => {
                const bone = npc.ragdoll.bodyBoneMap.get(body);
                const worldPos = new THREE.Vector3();
                const worldQuat = new THREE.Quaternion();
                bone.getWorldPosition(worldPos);
                bone.getWorldQuaternion(worldQuat);
                
                body.position.copy(worldPos);
                body.quaternion.copy(worldQuat);
                
                world.physics.addBody(body);
            });
            npc.ragdoll.constraints.forEach(c => world.physics.world.addConstraint(c));

            // Apply killing force
            if (killingImpulse) {
                const torsoBody = npc.ragdoll.bodyBoneMap.get(npc.mesh.getObjectByName('Spine'));
                if (torsoBody) {
                    torsoBody.applyImpulse(killingImpulse.scale(0.1), hitPoint || torsoBody.position);
                }
            }
        }
        
        // Prepare material for fading
        npc.mesh?.traverse(child => {
            if (child.isMesh) {
                child.material.transparent = true;
            }
        });
    }

    /**
     * Updates the opacity of an entity's mesh to create a fade-out effect.
     * @param {object} entity
     * @param {number} timer
     */
    updateFadeOut(entity, timer) {
        if (entity.mesh?.material) { // This won't work for group, need to traverse
            const opacity = Math.max(0, timer / DEATH_DURATION);
            entity.mesh.traverse(child => {
                if(child.isMesh) child.material.opacity = opacity;
            });
        }
    }
}