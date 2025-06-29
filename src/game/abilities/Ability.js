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
        const isReady = this.cooldownTimer >= this.cooldown;
        const hasEnergy = this.caster.currentEnergy >= this.energyCost;
        return isReady && hasEnergy;
    }

    /**
     * Executes the ability's logic. MUST be overridden by subclasses.
     * @returns {boolean} True if the cast was successful, false otherwise.
     */
    cast() {
        throw new Error("Ability.cast() must be implemented by subclasses.");
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