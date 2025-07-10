// src/game/weapons/WeaponFactory.js
import { CustomWeapon } from './CustomWeapon.js';

/**
 * A factory for creating weapon instances from their IDs.
 * It now asynchronously fetches weapon data from JSON files.
 */
export class WeaponFactory {
    // Cache to prevent re-fetching the same JSON data
    static weaponCache = new Map();

    /**
     * Creates a weapon instance for a given weapon ID.
     * @param {string} weaponId - The ID of the weapon (e.g., 'WEAPON_SAI').
     * @returns {Promise<CustomWeapon | null>} A promise that resolves to an instance of the weapon, or null if not found.
     */
    static async create(weaponId) {
        console.log(`[WeaponFactory] create called for ID: ${weaponId}`);
        if (this.weaponCache.has(weaponId)) {
            console.log(`[WeaponFactory] Found ${weaponId} in cache.`);
            return new CustomWeapon(this.weaponCache.get(weaponId));
        }

        try {
            // Normalize ID to file name convention (e.g., WEAPON_SAI -> weapon-sai.json)
            const fileName = `weapon-${weaponId.split('_')[1].toLowerCase()}.json`;
            const filePath = `./assets/weapons/${fileName}`;
            console.log(`[WeaponFactory] Fetching weapon data from: ${filePath}`);
            
            const response = await fetch(filePath);

            if (!response.ok) {
                // Log detailed error for easier debugging (e.g., 404 Not Found)
                console.error(`[WeaponFactory] Fetch failed for ${filePath}. Status: ${response.status} ${response.statusText}`);
                throw new Error(`Weapon data not found for ${weaponId} at ${response.url}`);
            }

            const weaponData = await response.json();
            console.log(`[WeaponFactory] Successfully fetched and parsed data for ${weaponId}:`, weaponData);
            weaponData.id = weaponId; // Ensure the ID is part of the data object
            
            this.weaponCache.set(weaponId, weaponData);

            return new CustomWeapon(weaponData);

        } catch (error) {
            console.error(`[WeaponFactory] CRITICAL: Failed to create weapon for ID: ${weaponId}`, error);
            return null;
        }
    }
}