/**
 * Base class for all weapons. Handles shared logic like cooldowns.
 */
export class Weapon {
    constructor(wielder, { name, damage, cooldown }) {
        this.wielder = wielder; // Can be null initially
        this.name = name || 'Unnamed Weapon';
        this.damage = damage || 10;
        this.cooldown = cooldown || 0.5;
        this.cooldownTimer = this.cooldown;
        this.mesh = null; // To be created by subclasses
    }

    canAttack() {
        return this.cooldownTimer >= this.cooldown;
    }

    attack() {
        throw new Error("Weapon.attack() must be implemented by subclasses.");
    }

    triggerCooldown() {
        this.cooldownTimer = 0;
    }

    update(deltaTime) {
        if (this.cooldownTimer < this.cooldown) {
            this.cooldownTimer += deltaTime;
        }
    }
}