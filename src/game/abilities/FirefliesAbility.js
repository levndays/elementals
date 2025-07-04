// ~ src/game/abilities/FirefliesAbility.js
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

    // Override startCasting to manage its own lifecycle.
    startCasting() {
        const { canCast, reasons } = this._getCastability();
        if (!canCast) {
            if (reasons.includes('on_cooldown') || reasons.includes('insufficient_energy')) {
                this.caster.world.emit('abilityCastFailed', { 
                    reasons: reasons,
                    entity: this.caster, 
                    ability: this 
                });
            }
            return false;
        }

        const castSuccessful = this._executeCast();

        if (castSuccessful) {
            // Consume energy upfront, but do NOT trigger cooldown here.
            if (!this.caster.world.game || !this.caster.world.game.debugModeActive) {
                this.caster.abilities.currentEnergy -= this.energyCost;
                this.caster.abilities.lastAbilityTime = this.caster.world.physics.world.time;
            }
            return true;
        }
        return false;
    }

    /**
     * Overridden to prevent the cast from being interrupted on button release.
     * The sequence, once started, runs to completion automatically.
     */
    stopCasting() {
        // Do nothing.
    }

    _executeCast() {
        const targetNPC = this.caster.lockedTarget; 
        if (!targetNPC || targetNPC.isDead) return false;

        this.isCasting = true;
        this.castTimer = 0;
        this.projectilesFired = 0;
        this.targetWhileCasting = targetNPC;

        return true;
    }

    update(deltaTime) {
        super.update(deltaTime); // Handles the main cooldown timer countdown

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
            // Trigger the cooldown AFTER the sequence is complete.
            if (!this.caster.world.game || !this.caster.world.game.debugModeActive) {
                this.triggerCooldown();
            }
        }
    }
}