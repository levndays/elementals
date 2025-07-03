// src/game/components/StatusEffectComponent.js

/**
 * A data component that holds and manages status effects for an entity.
 */
export class StatusEffectComponent {
    constructor() {
        /** @type {Map<string, import('../effects/StatusEffect.js').StatusEffect>} */
        this.activeEffects = new Map();
    }

    /**
     * Adds a new effect to the entity or refreshes the duration of an existing one.
     * @param {import('../effects/StatusEffect.js').StatusEffect} effect - The effect instance to add.
     */
    addEffect(effect) {
        const existing = this.activeEffects.get(effect.name);
        if (existing) {
            // Refresh duration of existing effect
            existing.timer = 0;
            return;
        }

        this.activeEffects.set(effect.name, effect);
        effect.apply();
    }

    /**
     * Checks if an effect is currently active.
     * @param {string} effectName - The name of the effect.
     * @returns {boolean}
     */
    has(effectName) {
        return this.activeEffects.has(effectName);
    }

    /**
     * Gets an active effect instance by name.
     * @param {string} effectName - The name of the effect.
     * @returns {import('../effects/StatusEffect.js').StatusEffect | undefined}
     */
    get(effectName) {
        return this.activeEffects.get(effectName);
    }
}