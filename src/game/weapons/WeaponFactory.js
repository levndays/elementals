import { Katana } from './Katana.js';
import { Revolver } from './Revolver.js';

const WeaponMap = {
    'WEAPON_001': Katana,
    'WEAPON_REVOLVER': Revolver,
};

/**
 * A factory for creating weapon instances from their IDs.
 */
export class WeaponFactory {
    /**
     * Creates a weapon instance for a given weapon ID.
     * @param {string} weaponId - The ID of the weapon (e.g., 'WEAPON_001').
     * @returns {import('./Weapon.js').Weapon | null} An instance of the weapon, or null if the ID is not found.
     */
    static create(weaponId) {
        const WeaponClass = WeaponMap[weaponId];

        if (WeaponClass) {
            return new WeaponClass();
        }

        console.warn(`WeaponFactory: No class found for weapon ID: ${weaponId}`);
        return null;
    }
}