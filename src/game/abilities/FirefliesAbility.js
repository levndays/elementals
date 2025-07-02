import { Ability } from './Ability.js';

export class FirefliesAbility extends Ability {
    constructor(caster, abilityData) {
        super(caster, abilityData);
        this.numProjectiles = 5;
        this.requiresLockOn = true;

        // State for update-based casting
        this.castTimer = 0;
        this.projectilesFired = 0;
        this.targetWhileCasting = null;
        this.CAST_INTERVAL = 0.075; // 75ms
    }

    _executeCast() {
        const targetEnemy = this.caster.lockedTarget; 
        if (!targetEnemy || targetEnemy.isDead) return false;

        this.isCasting = true;
        this.castTimer = 0;
        this.projectilesFired = 0;
        this.targetWhileCasting = targetEnemy;

        return true;
    }

    update(deltaTime) {
        super.update(deltaTime); // Handles the main cooldown

        if (!this.isCasting) return;

        this.castTimer += deltaTime;

        // Check if it's time to fire the next projectile
        if (this.castTimer >= this.projectilesFired * this.CAST_INTERVAL) {
            if (this.projectilesFired < this.numProjectiles) {
                if (!this.caster.isDead && this.targetWhileCasting && !this.targetWhileCasting.isDead) {
                    this.caster.world.createFireflyProjectile({ 
                        caster: this.caster, 
                        target: this.targetWhileCasting 
                    });
                }
                this.projectilesFired++;
            }
        }

        // End casting sequence
        if (this.projectilesFired >= this.numProjectiles) {
            this.isCasting = false;
            this.targetWhileCasting = null;
        }
    }
}