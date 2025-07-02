/**
 * Data component storing health and damage-related state for an entity.
 */
export class HealthComponent {
    constructor(maxHealth = 100) {
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        
        // For client-side visual feedback
        this.flashDuration = 0.15;
        this.flashTimer = 0;
    }
}