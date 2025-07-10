/**
 * Manages the update logic for weapons, such as cooldowns and animations.
 */
export class WeaponSystem {
    /**
     * @param {import('../world/World.js').World} world
     * @param {number} deltaTime
     */
    update(world, deltaTime) {
        // Specifically update the player's weapon if it exists and has an update method.
        if (world.player?.weapon?.update) {
            world.player.weapon.update(deltaTime);
        }

        // This loop is kept for potential future NPCs with complex, updatable weapons.
        for (const entity of world.getNPCs()) {
            if (entity.weapon?.update) {
                entity.weapon.update(deltaTime);
            }
        }
    }
}