// src/game/systems/PhysicsSyncSystem.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Synchronizes the visual representation (Three.js mesh) of entities
 * with their physics simulation state (CANNON-ES body).
 */

export class PhysicsSyncSystem {
    /**
     * @param {import('../world/World.js').World} world
     */
    update(world) {
        // General sync for all entities with a mesh and body
        for (const entity of world.getEntities()) {
            if (entity.isDead && entity.ragdoll?.bodies.length > 0) {
                // Ragdoll sync
                this._syncRagdoll(entity);
            } else if (entity.mesh && entity.physics?.body) {
                // Standard sync
                entity.mesh.position.copy(entity.physics.body.position);
                entity.mesh.quaternion.copy(entity.physics.body.quaternion);
            }
        }

        // Specific sync for the player's camera, which acts as the 'view'
        if (world.player && !world.player.isDead) {
            world.player.camera.position.copy(world.player.physics.body.position);
        }
    }

    _syncRagdoll(npc) {
        // The main container group follows the Hips bone's physics body
        const hipsBody = npc.ragdoll.bodyBoneMap.get(npc.mesh.getObjectByName('Hips'));
        if (hipsBody) {
            npc.mesh.position.copy(hipsBody.position);
            npc.mesh.quaternion.copy(hipsBody.quaternion);
        }
        
        // Now, update each bone's rotation to match its physics body.
        // We only need to sync rotations because the skinned mesh will handle positions
        // relative to the parent bones.
        for (const [body, bone] of npc.ragdoll.bodyBoneMap.entries()) {
            // Get the physics rotation in world space
            const physicsWorldQuat = new THREE.Quaternion().copy(body.quaternion);
            
            // Get the parent bone's world rotation
            const parentWorldQuat = new THREE.Quaternion();
            if (bone.parent && bone.parent.isBone) {
                bone.parent.getWorldQuaternion(parentWorldQuat);
            }
            
            // The bone's local rotation is the physics rotation relative to its parent's rotation.
            bone.quaternion.copy(parentWorldQuat.invert()).multiply(physicsWorldQuat);
        }
    }
}