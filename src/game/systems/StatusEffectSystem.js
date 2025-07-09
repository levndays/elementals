// ~ src/game/systems/StatusEffectSystem.js
/**
 * Manages the lifecycle of all active status effects in the world.
 * It ticks effects, checks for expiration, and handles their removal.
 */
export class StatusEffectSystem {
    /**
     * @param {import('../world/World.js').World} world
     * @param {number} deltaTime
     */
    update(world, deltaTime) {
        for (const entity of world.getEntities()) {
            if (!entity.statusEffects) continue;

            const effectsToDelete = [];
            for (const effect of entity.statusEffects.activeEffects.values()) {
                effect.tick(deltaTime);
                if (effect.isFinished) {
                    effectsToDelete.push(effect);
                }
            }

            for (const effect of effectsToDelete) {
                effect.remove();
                entity.statusEffects.activeEffects.delete(effect.name);
            }
        }
    }
}