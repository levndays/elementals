import { GAME_CONFIG } from '../../shared/config.js';

/**
 * A system to handle entities falling out of the world bounds.
 * This acts as a failsafe to prevent soft-locks.
 */

export class OutOfBoundsSystem {
    /**
     * @param {import('../world/World.js').World} world
     * @param {number} deltaTime
     */
    update(world, deltaTime) {
        const threshold = GAME_CONFIG.DEATH_Y;

        for (const entity of world.getEntities()) {
            // Skip entities that are already dead or don't have a physics body
            if (entity.isDead || !entity.physics?.body) continue;

            if (entity.physics.body.position.y < threshold) {
                // The `die` method on both Player and Enemy will handle the necessary events.
                if (typeof entity.die === 'function') {
                    entity.die();
                }
            }
        }
    }
}