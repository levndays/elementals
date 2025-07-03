// src/game/effects/StatusEffect.js

/**
 * Represents a single buff, debuff, or state applied to an entity.
 * Encapsulates duration, properties, and lifecycle callbacks.
 */
export class StatusEffect {
    /**
     * @param {object} target - The entity the effect is applied to.
     * @param {object} options - Configuration for the effect.
     * @param {string} options.name - The unique name of the effect.
     * @param {number} [options.duration=Infinity] - The duration of the effect in seconds.
     * @param {object} [options.properties={}] - A key-value store for static data like damage multipliers.
     * @param {Function} [options.onApply] - Callback executed when the effect is first applied.
     * @param {Function} [options.onTick] - Callback executed on every game update.
     * @param {Function} [options.onRemove] - Callback executed when the effect expires or is removed.
     */
    constructor(target, { name, duration = Infinity, properties = {}, onApply, onTick, onRemove }) {
        this.target = target;
        this.name = name;
        this.duration = duration;
        this.properties = properties;
        this.timer = 0;
        this.isFinished = false;

        this._onApply = onApply;
        this._onTick = onTick;
        this._onRemove = onRemove;
    }

    /**
     * Called when the effect is first added to a target.
     */
    apply() {
        if (this._onApply) {
            this._onApply(this.target);
        }
    }

    /**
     * Called every frame the effect is active.
     * @param {number} deltaTime - The time since the last frame.
     */
    tick(deltaTime) {
        this.timer += deltaTime;
        if (this.duration !== Infinity && this.timer >= this.duration) {
            this.isFinished = true;
        }
        if (this._onTick) {
            this._onTick(this.target, deltaTime);
        }
    }

    /**
     * Called when the effect is removed from a target.
     */
    remove() {
        if (this._onRemove) {
            this._onRemove(this.target);
        }
    }
}