// src/game/abilities/Ability.js
import { GAME_CONFIG } from '../../shared/config.js';

/**
 * Base class for all player abilities. Handles shared logic like cooldowns and energy costs.
 * Subclasses must implement the _executeCast method.
 */
export class Ability {
    constructor(caster, abilityData) {
        this.caster = caster;
        this.data = abilityData;
        this.name = abilityData.name || 'Unnamed Ability';
        this.icon = abilityData.icon || '?';
        this.cooldown = abilityData.cooldown || 0;
        this.energyCost = abilityData.energyCost || 0;
        this.element = abilityData.element || 'Utility';
        this.isCasting = false;
        this.castType = abilityData.castType || 'instant';

        // Start ready to cast
        this.cooldownTimer = this.cooldown;
    }

    /**
     * Checks if the ability can be cast based on cooldown and caster's energy.
     * @returns {{canCast: boolean, reasons: string[]}}
     */
    _getCastability() {
        const reasons = [];
        if (this.caster.world.game?.debugModeActive) return { canCast: true, reasons: [] };

        if (this.isCasting) reasons.push('is_casting');
        if (this.cooldownTimer < this.cooldown) reasons.push('on_cooldown');
        if (this.caster.abilities.currentEnergy < this.energyCost) reasons.push('insufficient_energy');
        
        return { canCast: reasons.length === 0, reasons };
    }

    /**
     * Executes the ability's core logic. Must be implemented by subclasses.
     * @returns {boolean} True if the cast logic was successful, false otherwise.
     * @protected
     */
    _executeCast() {
        throw new Error("Ability._executeCast() must be implemented by subclasses.");
    }
    
    /**
     * Public-facing method to cast the ability. Handles resource consumption and cooldowns.
     * @returns {boolean} True if the cast was successful, false otherwise.
     */
    cast() {
        const { canCast, reasons } = this._getCastability();

        if (!canCast) {
            // Emit an event with all failure reasons if there are any user-facing ones
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
            if (!this.caster.world.game || !this.caster.world.game.debugModeActive) {
                this.caster.abilities.currentEnergy -= this.energyCost;
                this.caster.abilities.lastAbilityTime = this.caster.world.physics.world.time;
                this.triggerCooldown();
            }
            return true;
        }
        return false;
    }

    /**
     * Called on button press. For instant abilities, this just casts.
     * Channeling abilities should override this to begin their channeling state.
     */
    startCasting() {
        return this.cast();
    }

    /**
     * Called on button release.
     * Channeling abilities should override this to end their channeling state.
     */
    stopCasting() {
        this.isCasting = false;
    }

    /**
     * Resets the cooldown timer after casting.
     */
    triggerCooldown() {
        this.cooldownTimer = 0;
    }

    /**
     * Gets the current cooldown progress as a value from 0.0 to 1.0.
     * @returns {number}
     */
    getCooldownProgress() {
        if (this.cooldown === 0) return 1.0;
        return Math.min(this.cooldownTimer / this.cooldown, 1.0);
    }
    
    /**
     * Updates the cooldown timer.
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    update(deltaTime) {
        if (this.cooldownTimer < this.cooldown) {
            this.cooldownTimer += deltaTime;
        }
    }
}