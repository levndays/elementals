// + src/game/systems/WeaponSystem.js

/**
 * Manages the update logic for weapons, such as cooldowns and animations.
 */
export class WeaponSystem {
    /**
     * @param {import('../world/World.js').World} world
     * @param {number} deltaTime
     */
    update(world, deltaTime) {
        for (const entity of world.getEntities()) {
            if (entity.weapon?.update) {
                entity.weapon.update(deltaTime);
            }
        }
    }
}