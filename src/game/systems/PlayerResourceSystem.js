import { GAME_CONFIG } from '../../shared/config.js';

/**
 * Manages player-specific resources like energy and oxygen.
 */
export class PlayerResourceSystem {
    /**
     * @param {import('../world/World.js').World} world
     * @param {number} deltaTime
     */
    update(world, deltaTime) {
        const player = world.player;
        if (!player || player.isDead) return;

        this._updateEnergy(world, player, deltaTime);
        this._updateOxygen(player, deltaTime);
    }

    _updateEnergy(world, player, deltaTime) {
        const abilities = player.abilities;
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

    _updateOxygen(player, deltaTime) {
        const config = GAME_CONFIG.PLAYER;
        const isConsumingOxygen = player.isSwimming && !player.isWaterSpecialist;

        if (isConsumingOxygen) {
            player.currentOxygen -= config.OXYGEN_CONSUMPTION_RATE * deltaTime;
            if (player.currentOxygen <= 0) {
                player.currentOxygen = 0;
                player.takeDamage(config.OXYGEN_DAMAGE_PER_SECOND * deltaTime);
            }
        } else {
            if (player.currentOxygen < player.maxOxygen) {
                player.currentOxygen = Math.min(
                    player.maxOxygen,
                    player.currentOxygen + config.OXYGEN_REGEN_RATE * deltaTime
                );
            }
        }
    }
}