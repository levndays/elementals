import { Ability } from './Ability.js';
import { FireflyProjectile } from './FireflyProjectile.js';

export class FirefliesAbility extends Ability {
    constructor(caster) {
        super(caster, {
            name: 'Fireflies',
            icon: 'FF', // Icon for the HUD
            cooldown: 10.0, // 10-second cooldown
            energyCost: 300, // 300 energy points to cast
        });
        this.numProjectiles = 5; // Number of fireflies to shoot
        this.requiresLockOn = true; // This ability needs a locked target
    }

    /**
     * @override
     * @protected
     * Executes the Fireflies ability's core logic.
     * Launches multiple homing projectiles towards the enemy currently targeted by the player's crosshair.
     */
    _executeCast() {
        // Use the pre-determined target from player's crosshair logic
        const targetEnemy = this.caster.lockedTarget; 

        if (!targetEnemy || targetEnemy.isDead) {
            console.log("Fireflies: No valid enemy target found.");
            return false; 
        }

        // Spawn the specified number of firefly projectiles, all targeting the same enemy
        for (let i = 0; i < this.numProjectiles; i++) {
            // Add a slight delay between projectiles for visual effect
            setTimeout(() => {
                if (!this.caster.isDead) { // Ensure player is still alive before spawning
                    new FireflyProjectile({ caster: this.caster, target: targetEnemy });
                }
            }, i * 75); // 75ms delay between each projectile
        }

        return true;
    }
}