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
    }

    /**
     * @override
     * Executes the Fireflies ability.
     * Launches multiple homing projectiles towards the enemy currently targeted by the player's crosshair.
     */
    cast() {
        if (this.canCast()) { // Check if ability is off cooldown and player has enough energy
            // Use the pre-determined target from player's crosshair logic
            const targetEnemy = this.caster.lockedTarget; 

            if (!targetEnemy || targetEnemy.isDead) {
                console.log("Fireflies: No valid enemy target found."); // Modified log message
                // If no target, don't consume resources or trigger cooldown
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

            // Consume energy and trigger the ability's cooldown
            this.caster.currentEnergy -= this.energyCost;
            this.caster.lastAbilityTime = this.caster.world.time; // Update last ability time for energy regen delay
            this.triggerCooldown();
            
            console.log(`Casted ${this.name}. Energy: ${Math.floor(this.caster.currentEnergy)} / ${this.caster.maxEnergy}`);
            return true;
        }
        return false;
    }
}