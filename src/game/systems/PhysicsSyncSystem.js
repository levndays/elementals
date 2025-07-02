// src/game/systems/PhysicsSyncSystem.js

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
            if (entity.mesh && entity.physics?.body) {
                entity.mesh.position.copy(entity.physics.body.position);
                entity.mesh.quaternion.copy(entity.physics.body.quaternion);
            }
        }

        // Specific sync for the player's camera, which acts as the 'view'
        if (world.player && !world.player.isDead) {
            world.player.camera.position.copy(world.player.physics.body.position);
        }
    }
}