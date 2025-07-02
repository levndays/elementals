import * as THREE from 'three';

/**
 * A collection of common utility functions.
 */

export const Util = {
    /**
     * Calculates the launch velocity for a projectile to hit a target, considering gravity.
     * @param {THREE.Vector3} startPos - The starting position of the projectile.
     * @param {THREE.Vector3} targetPos - The target position.
     * @param {number} projectileSpeed - The initial speed of the projectile.
     * @param {number} gravity - The magnitude of gravity (should be positive).
     * @returns {THREE.Vector3|null} The initial velocity vector, or null if the target is unreachable.
     */
    calculateBallisticLaunchVelocity(startPos, targetPos, projectileSpeed, gravity) {
        const delta = new THREE.Vector3().subVectors(targetPos, startPos);
        const deltaXZ = new THREE.Vector2(delta.x, delta.z);
        const distXZ = deltaXZ.length();

        const v = projectileSpeed;
        const g = gravity;
        const y = delta.y;
        const x = distXZ;

        const discriminant = v**4 - g * (g * x**2 + 2 * y * v**2);
        
        if (discriminant < 0) {
            // Target is out of range
            return null;
        }

        // We choose the lower angle for a more direct shot. 
        // Use + for a higher, arcing shot.
        const angle = Math.atan2(v**2 - Math.sqrt(discriminant), g * x);
        
        const Vy = v * Math.sin(angle);
        const Vxz = v * Math.cos(angle);
        
        const dirXZ = deltaXZ.normalize();
        
        return new THREE.Vector3(dirXZ.x * Vxz, Vy, dirXZ.y * Vxz);
    }
};