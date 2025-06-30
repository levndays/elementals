export class Ability {
    constructor(caster, { name, icon, cooldown, energyCost }) {
        this.caster = caster;
        this.name = name || 'Unnamed Ability';
        this.icon = icon || '?';
        this.cooldown = cooldown || 0;
        this.energyCost = energyCost || 0;

        this.cooldownTimer = this.cooldown; // Start ready to cast
    }

    /**
     * Checks if the ability can be cast based on cooldown and energy.
     * @returns {boolean}
     */
    canCast() {
        if (this.caster.game.debugModeActive) return true; // Debug mode bypasses checks

        const isReady = this.cooldownTimer >= this.cooldown;
        const hasEnergy = this.caster.currentEnergy >= this.energyCost;
        return isReady && hasEnergy;
    }

    /**
     * Executes the ability's core logic. To be implemented by subclasses.
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
        if (!this.canCast()) return false;

        const castSuccessful = this._executeCast();

        if (castSuccessful) {
            if (!this.caster.game.debugModeActive) {
                this.caster.currentEnergy -= this.energyCost;
                this.caster.lastAbilityTime = this.caster.world.time;
                this.triggerCooldown();
            }
            console.log(`Casted ${this.name}.`);
            return true;
        }

        return false;
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