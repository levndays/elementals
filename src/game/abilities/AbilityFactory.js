// ~ src/game/abilities/AbilityFactory.js
import { FireballAbility } from './FireballAbility.js';
import { FirefliesAbility } from './FirefliesAbility.js';
import { StonePlatingAbility } from './StonePlatingAbility.js';
import { WavePowerAbility } from './WavePowerAbility.js';

const AbilityMap = {
    'FIRE_001': FireballAbility,
    'FIRE_002': FirefliesAbility,
    'EARTH_001': StonePlatingAbility,
    'WATER_001': WavePowerAbility,
    // Add new ability classes here
};

let allAbilitiesData = null; // Module-level cache

/**
 * A factory for creating ability instances from their IDs.
 */
export class AbilityFactory {
    /**
     * Loads and caches the ability definitions from the JSON file.
     * Must be called once before any abilities can be created.
     */
    static async init() {
        if (allAbilitiesData) return; // Already initialized
        try {
            const response = await fetch('./data/abilities.json');
            allAbilitiesData = await response.json();
            console.log('Ability data loaded successfully.');
        } catch (error) {
            console.error('Failed to load ability data:', error);
            allAbilitiesData = {}; // Prevent further failed attempts
        }
    }

    /**
     * Creates an ability instance for a given caster and card ID.
     * @param {string} cardId - The ID of the ability card (e.g., 'FIRE_001').
     * @param {object} caster - The entity that will use the ability.
     * @returns {import('./Ability.js').Ability | null} An instance of the ability, or null if the ID is not found.
     */
    static create(cardId, caster) {
        if (!allAbilitiesData) {
            console.error('AbilityFactory not initialized. Call init() first.');
            return null;
        }

        const AbilityClass = AbilityMap[cardId];
        const abilityData = allAbilitiesData[cardId];

        if (AbilityClass && abilityData) {
            // Pass the full data object to the constructor
            return new AbilityClass(caster, abilityData);
        }

        console.warn(`AbilityFactory: No class or data found for card ID: ${cardId}`);
        return null;
    }
}