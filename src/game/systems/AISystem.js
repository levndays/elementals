// src/game/systems/AISystem.js
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';
import { Util } from '../../shared/util.js';
import { GAME_CONFIG } from '../../shared/config.js';

/**
 * Manages AI behavior for enemy entities.
 */
export class AISystem {
    constructor() {
        // --- PERFORMANCE: Reusable objects to prevent GC churn ---
        this._perceptionRayFrom = new CANNON.Vec3();
        this._perceptionRayTo = new CANNON.Vec3();
        this._losRayResult = new CANNON.RaycastResult();
        this._obstacleRayResult = new CANNON.RaycastResult();
        this._groundRayResult = new CANNON.RaycastResult();
        this._lookAtTarget = new THREE.Vector3();
        this._tempQuaternion = new CANNON.Quaternion();
        this._tempObject3D = new THREE.Object3D();
    }

    /**
     * @param {import('../world/World.js').World} world
     * @param {number} deltaTime
     */
    update(world, deltaTime) {
        const player = world.player;
        if (!player || player.isDead) {
            world.getEnemies().forEach(enemy => {
                enemy.ai.state = 'IDLE';
                enemy.physics.body.velocity.x *= 0.9;
                enemy.physics.body.velocity.z *= 0.9;
            });
            return;
        }

        for (const enemy of world.getEnemies()) {
            if (enemy.isDead) continue;

            if (enemy.ai.isKnockedBack) {
                enemy.ai.knockbackTimer -= deltaTime;
                if (enemy.ai.knockbackTimer <= 0) {
                    enemy.ai.isKnockedBack = false;
                }
                continue; // Skip AI logic while knocked back
            }
            
            enemy.ai.aiUpdateTimer += deltaTime;
            if (enemy.ai.aiUpdateTimer >= enemy.ai.aiUpdateInterval) {
                this._runAI(world, enemy, player);
                enemy.ai.aiUpdateTimer = 0;
            }
            
            this._updateTimers(enemy.ai, deltaTime);
            this._applyMovement(enemy);
        }
    }
    
    _runAI(world, enemy, player) {
        this._updatePerception(world, enemy, player);
        this._updateState(enemy);
        this._executeStateActions(world, enemy, player);
    }
    
    _updatePerception(world, enemy, player) {
        const ai = enemy.ai;
        ai.perception.distanceToPlayer = enemy.physics.body.position.distanceTo(player.physics.body.position);
        
        this._perceptionRayFrom.copy(enemy.physics.body.position);
        this._perceptionRayFrom.y += 1.0;
        this._perceptionRayTo.copy(player.physics.body.position);
        this._perceptionRayTo.y += 1.0;

        this._losRayResult.reset();
        world.physics.world.raycastClosest(
            this._perceptionRayFrom, this._perceptionRayTo,
            { collisionFilterMask: COLLISION_GROUPS.WORLD, skipBackfaces: true },
            this._losRayResult
        );
        
        ai.perception.hasLineOfSight = !this._losRayResult.hasHit;
        if (ai.perception.hasLineOfSight) {
            ai.lastKnownPlayerPosition.copy(player.physics.body.position);
        }
    }

    _updateState(enemy) {
        const ai = enemy.ai;
        if (ai.perception.hasLineOfSight && ai.perception.distanceToPlayer < ai.perception.detectionRange) {
            ai.state = 'COMBAT';
        } else if (ai.state === 'COMBAT' && ai.perception.distanceToPlayer > ai.perception.loseSightRange) {
            ai.state = 'SEARCHING';
        } else if (ai.state === 'SEARCHING' && enemy.physics.body.position.distanceTo(ai.lastKnownPlayerPosition) < 2) {
            ai.state = 'IDLE';
        }
    }

    _executeStateActions(world, enemy, player) {
        const { ai, physics } = enemy;
        if (ai.isDashing) {
            if (ai.dashStateTimer >= ai.dashDuration) ai.isDashing = false;
            return;
        }
        
        this._faceTarget(enemy, ai.lastKnownPlayerPosition);
        if (ai.state === 'COMBAT') this._handleCombatDecisions(world, enemy, player);
    }

    _handleCombatDecisions(world, enemy, player) {
        const { ai, physics } = enemy;
        const { distanceToPlayer, hasLineOfSight, attackRange } = ai.perception;
        
        if (hasLineOfSight && distanceToPlayer <= attackRange && ai.actionTimers.attack <= 0) {
            this._shoot(world, enemy, player);
            ai.actionTimers.attack = ai.actionCooldowns.attack;
        }

        this._navigateObstacles(world, enemy);
        if (ai.actionTimers.dash <= 0) {
            const toPlayerDir = new CANNON.Vec3().copy(ai.lastKnownPlayerPosition).vsub(physics.body.position);
            const right = new THREE.Vector3().crossVectors(toPlayerDir, CANNON.Vec3.UNIT_Y).normalize();
            ai.dashDirection.copy(right.multiplyScalar(Math.random() > 0.5 ? 1 : -1));
            ai.isDashing = true;
            ai.dashStateTimer = 0;
            ai.actionTimers.dash = ai.actionCooldowns.dash;
        }
    }

    _applyMovement(enemy) {
        const { ai, physics } = enemy;
        const speed = GAME_CONFIG.ENEMY.DUMMY.SPEED;
        
        physics.body.wakeUp(); // Wake the body before changing its velocity.

        if (ai.isDashing) {
            const dashSpeed = speed * GAME_CONFIG.PLAYER.DASH_SPEED_MULTIPLIER;
            physics.body.velocity.x = ai.dashDirection.x * dashSpeed;
            physics.body.velocity.y = 0;
            physics.body.velocity.z = ai.dashDirection.z * dashSpeed;
            return;
        }

        let moveDirection = new CANNON.Vec3();
        switch(ai.state) {
            case 'IDLE': physics.body.velocity.x *= 0.9; physics.body.velocity.z *= 0.9; break;
            case 'SEARCHING':
                ai.lastKnownPlayerPosition.vsub(physics.body.position, moveDirection);
                break;
            case 'COMBAT':
                moveDirection = this._getCombatRepositionVector(enemy);
                break;
        }
        
        if (moveDirection.lengthSquared() > 0) {
            moveDirection.y = 0;
            moveDirection.normalize();
            physics.body.velocity.x = moveDirection.x * speed;
            physics.body.velocity.z = moveDirection.z * speed;
        }
    }
    
    _getCombatRepositionVector(enemy) {
        const { ai, physics } = enemy;
        const { distanceToPlayer, optimalRange, minimumRange } = ai.perception;
        const toPlayerDir = new CANNON.Vec3().copy(ai.lastKnownPlayerPosition).vsub(physics.body.position);

        if (distanceToPlayer > optimalRange) return toPlayerDir;
        if (distanceToPlayer < minimumRange) return toPlayerDir.negate();
        
        if (ai.actionTimers.reposition <= 0) {
            ai.strafeDirection *= -1;
            ai.actionTimers.reposition = ai.actionCooldowns.reposition;
        }
        return new CANNON.Vec3(toPlayerDir.z, 0, -toPlayerDir.x).scale(ai.strafeDirection);
    }
    
    _navigateObstacles(world, enemy) {
        const { physics, ai } = enemy;
        if (physics.body.velocity.lengthSquared() < 0.1 || ai.actionTimers.jump <= 0) return;

        const rayFrom = new CANNON.Vec3().copy(physics.body.position);
        
        const velocityDirection = physics.body.velocity.clone();
        velocityDirection.normalize(); // Normalizes in-place, returns length. Do not chain.
        const rayVector = velocityDirection.scale(2); // .scale() returns a new scaled vector.
        const rayTo = rayFrom.clone().vadd(rayVector);

        this._obstacleRayResult.reset();
        world.physics.world.raycastClosest(rayFrom, rayTo, { collisionFilterMask: COLLISION_GROUPS.WORLD }, this._obstacleRayResult);
        
        if (this._obstacleRayResult.hasHit) {
             const groundRayTo = rayFrom.clone().vadd(new CANNON.Vec3(0, -1.1, 0));
             this._groundRayResult.reset();
             world.physics.world.raycastClosest(rayFrom, groundRayTo, { collisionFilterMask: COLLISION_GROUPS.WORLD }, this._groundRayResult);
             if (this._groundRayResult.hasHit) {
                 physics.body.velocity.y = GAME_CONFIG.PLAYER.JUMP_HEIGHT;
                 ai.actionTimers.jump = ai.actionCooldowns.jump;
             }
        }
    }
    
    _shoot(world, enemy, player) {
        const config = GAME_CONFIG.ENEMY.DUMMY;
        const timeToTarget = enemy.ai.perception.distanceToPlayer / config.PROJECTILE_SPEED;
        const predictionTime = Math.min(timeToTarget, 1.0);
        const predictedPosition = new THREE.Vector3().copy(player.physics.body.position).add(
            new THREE.Vector3().copy(player.physics.body.velocity).multiplyScalar(predictionTime)
        );
        predictedPosition.y += 0.5;

        const launchVelocity = Util.calculateBallisticLaunchVelocity(
            new THREE.Vector3().copy(enemy.physics.body.position), predictedPosition,
            config.PROJECTILE_SPEED, Math.abs(world.physics.world.gravity.y)
        );

        world.createEnemyProjectile({
            caster: enemy,
            initialVelocity: launchVelocity || new THREE.Vector3().subVectors(predictedPosition, enemy.physics.body.position).normalize().multiplyScalar(config.PROJECTILE_SPEED)
        });
    }

    _updateTimers(ai, deltaTime) {
        for (const key in ai.actionTimers) {
            if (ai.actionTimers[key] > 0) {
                ai.actionTimers[key] -= deltaTime;
            }
        }
        if (ai.isDashing) ai.dashStateTimer += deltaTime;
    }
    
    _faceTarget(enemy, targetPosition) {
        this._lookAtTarget.copy(targetPosition);
        this._lookAtTarget.y = enemy.physics.body.position.y;
        this._tempObject3D.position.copy(enemy.physics.body.position);
        this._tempObject3D.lookAt(this._lookAtTarget);
        this._tempQuaternion.copy(this._tempObject3D.quaternion);
        enemy.physics.body.quaternion.slerp(this._tempQuaternion, 0.1, enemy.physics.body.quaternion);
    }
}