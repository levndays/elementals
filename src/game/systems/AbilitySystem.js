import { GAME_CONFIG } from '../../shared/config.js';

/**
 * Manages ability cooldowns for entities.
 * Energy regeneration is now handled by PlayerResourceSystem.
 */
export class AbilitySystem {
    /**
     * @param {import('../world/World.js').World} world
     * @param {number} deltaTime
     */
    update(world, deltaTime) {
        for (const entity of world.getEntities()) {
            if (entity.abilities) {
                this._updateCooldowns(entity.abilities, deltaTime);
            }
        }
    }

    _updateCooldowns(abilitiesComponent, deltaTime) {
        for (const ability of abilitiesComponent.abilities) {
            if (ability) {
                ability.update(deltaTime);
            }
        }
    }
}