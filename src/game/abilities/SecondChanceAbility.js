import { Ability } from './Ability.js';

export class SecondChanceAbility extends Ability {
    constructor(caster, abilityData) {
        super(caster, abilityData);

        this.isChanneling = false;
        // Constants for the ability's mechanics
        this.HEALTH_PER_SECOND = 50;
        this.ENERGY_PER_HEALTH = 2;
        this.ENERGY_PER_SECOND = this.HEALTH_PER_SECOND * this.ENERGY_PER_HEALTH;
    }

    // Override startCasting to avoid the base class's instant cooldown trigger.
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

        if (this.caster.health.currentHealth >= this.caster.health.maxHealth) {
            return false; // Silently fail if already at full health
        }
        
        if (this.caster.abilities.currentEnergy <= 0) {
            this.caster.world.emit('abilityCastFailed', {
                reasons: ['insufficient_energy'],
                entity: this.caster,
                ability: this,
            });
            return false;
        }

        this.isChanneling = true;
        this.caster.world.emit('playerChannelingUpdate', { isChanneling: true, ability: this });
        return true;
    }

    // Override stopCasting to trigger cooldown on release.
    stopCasting() {
        if (!this.isChanneling) return;
        
        this.isChanneling = false;
        this.caster.world.emit('playerChannelingUpdate', { isChanneling: false, ability: this });

        // Don't trigger cooldown in debug mode
        if (this.caster.world.game && this.caster.world.game.debugModeActive) return;

        this.triggerCooldown();
    }

    update(deltaTime) {
        super.update(deltaTime); // This still handles ticking up the cooldownTimer

        if (!this.isChanneling) {
            return;
        }

        if (this.caster.health.currentHealth >= this.caster.health.maxHealth || this.caster.abilities.currentEnergy <= 0) {
            this.stopCasting(); // Stop channeling and trigger cooldown
            return;
        }

        const energyToDrain = this.ENERGY_PER_SECOND * deltaTime;
        const actualEnergyDrained = Math.min(energyToDrain, this.caster.abilities.currentEnergy);
        
        this.caster.abilities.currentEnergy -= actualEnergyDrained;
        
        const healthToGain = actualEnergyDrained / this.ENERGY_PER_HEALTH;
        this.caster.health.currentHealth = Math.min(
            this.caster.health.maxHealth,
            this.caster.health.currentHealth + healthToGain
        );
    }
}