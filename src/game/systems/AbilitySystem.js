import { GAME_CONFIG } from '../../shared/config.js';

/**
 * Manages ability cooldowns and energy regeneration for entities.
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
                this._updateEnergy(world, entity, deltaTime);
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

    _updateEnergy(world, entity, deltaTime) {
        const abilities = entity.abilities;
        const config = GAME_CONFIG.PLAYER;

        if (world.physics.world.time - abilities.lastAbilityTime > config.ENERGY_REGEN_DELAY) {
            if (abilities.currentEnergy < abilities.maxEnergy) {
                abilities.currentEnergy = Math.min(
                    abilities.maxEnergy,
                    abilities.currentEnergy + config.ENERGY_REGEN_RATE * deltaTime
                );
            }
        }
    }
}