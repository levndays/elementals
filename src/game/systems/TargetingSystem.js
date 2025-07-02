import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GAME_CONFIG } from '../../shared/config.js';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';

/**
 * Handles target acquisition for abilities that require a lock-on.
 */
export class TargetingSystem {
    constructor() {
        // Reusable objects to prevent garbage collection churn
        this._targetRayOrigin = new THREE.Vector3();
        this._targetRayDirection = new THREE.Vector3();
        this._enemyPos = new THREE.Vector3();
        this._toEnemyVector = new THREE.Vector3();
        this._losRayFrom = new CANNON.Vec3();
        this._losRayTo = new CANNON.Vec3();
        this._raycastResult = new CANNON.RaycastResult();
    }

    /**
     * Updates the player's locked-on target based on the current view and selected ability.
     * @param {import('../world/World.js').World} world
     * @param {number} deltaTime
     */
    update(world, deltaTime) {
        const player = world.player;
        if (!player || player.isDead) return;

        const currentAbility = player.abilities.abilities[player.abilities.selectedAbilityIndex];
        if (!currentAbility?.requiresLockOn) {
            player.lockedTarget = null;
            return;
        }

        player.camera.getWorldPosition(this._targetRayOrigin);
        player.camera.getWorldDirection(this._targetRayDirection);

        let bestEnemy = null;
        let minScore = Infinity;

        for (const enemy of world.getEnemies()) {
            if (enemy.isDead) continue;
            
            this._enemyPos.copy(enemy.physics.body.position);
            this._enemyPos.y += 1.0; // Aim for the center of the enemy's body

            const distanceToEnemy = this._targetRayOrigin.distanceTo(this._enemyPos);
            if (distanceToEnemy > GAME_CONFIG.TARGETING.MAX_RANGE) continue;
            
            this._toEnemyVector.subVectors(this._enemyPos, this._targetRayOrigin).normalize();
            
            const dotProduct = this._toEnemyVector.dot(this._targetRayDirection);
            if (dotProduct < 0) continue; // Enemy is behind the player

            const angle = Math.acos(Math.min(1, Math.max(-1, dotProduct)));

            if (angle < GAME_CONFIG.TARGETING.MAX_ANGLE_RAD) {
                // Perform line-of-sight check
                this._losRayFrom.copy(this._targetRayOrigin);
                this._losRayTo.copy(this._enemyPos);
                
                this._raycastResult.reset();
                world.physics.world.raycastClosest(
                    this._losRayFrom, this._losRayTo, 
                    { collisionFilterMask: COLLISION_GROUPS.WORLD, skipBackfaces: true }, 
                    this._raycastResult
                );

                if (!this._raycastResult.hasHit) {
                    // Score prioritizes being closer to the center of the screen, then distance.
                    const score = angle + (distanceToEnemy / GAME_CONFIG.TARGETING.MAX_RANGE);
                    if (score < minScore) {
                        minScore = score;
                        bestEnemy = enemy;
                    }
                }
            }
        }
        player.lockedTarget = bestEnemy;
    }
}