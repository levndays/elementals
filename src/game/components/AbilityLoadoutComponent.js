/**
 * Data component storing an entity's equipped abilities and related state.
 */
export class AbilityLoadoutComponent {
    constructor() {
        /** @type {import('../abilities/Ability.js').Ability[]} */
        this.abilities = [null, null, null, null];
        this.selectedAbilityIndex = 0;

        this.currentEnergy = 1000;
        this.maxEnergy = 1000;
        this.energyRegenRate = 25; // per second
        this.energyRegenDelay = 5.0; // seconds
        this.lastAbilityTime = -Infinity;
    }
}