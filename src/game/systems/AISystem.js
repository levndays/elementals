// src/game/systems/AISystem.js
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';
import { Util } from '../../shared/util.js';
import { GAME_CONFIG } from '../../shared/config.js';

/**
 * Manages AI behavior for NPC entities.
 */
export class AISystem {
    constructor() {
        // --- PERFORMANCE: Reusable objects to prevent GC churn ---
        this._perceptionRayFrom = new CANNON.Vec3();
        this._perceptionRayTo = new CANNON.Vec3();
        this._losRayResult = new CANNON.RaycastResult();
        this._obstacleRayResult = new CANNON.RaycastResult();
        this._groundRayResult = new CANNON.RaycastResult();
        this._ledgeProbePoint = new CANNON.Vec3();
        this._ledgeRayResult = new CANNON.RaycastResult();
        this._lookAtTarget = new THREE.Vector3();
        this._tempQuaternion = new CANNON.Quaternion();
        this._tempObject3D = new THREE.Object3D();
        this._forward = new THREE.Vector3();
    }

    /**
     * @param {import('../world/World.js').World} world
     * @param {number} deltaTime
     */
    update(world, deltaTime) {
        for (const npc of world.getNPCs()) {
            if (npc.isDead) continue;

            if (npc.ai.isKnockedBack) {
                npc.ai.knockbackTimer -= deltaTime;
                if (npc.ai.knockbackTimer <= 0) npc.ai.isKnockedBack = false;
                continue;
            }
            
            npc.ai.aiUpdateTimer += deltaTime;
            if (npc.ai.aiUpdateTimer >= npc.ai.aiUpdateInterval) {
                this._runAI(world, npc);
                npc.ai.aiUpdateTimer = 0;
            }
            
            this._updateTimers(npc.ai, deltaTime);
            this._applyMovement(world, npc);
        }
    }
    
    _runAI(world, npc) {
        this._updateTarget(world, npc);
        if (!npc.ai.target) {
            npc.ai.state = 'IDLE';
            npc.physics.body.velocity.x *= 0.9;
            npc.physics.body.velocity.z *= 0.9;
            return;
        }

        this._updatePerception(world, npc);
        this._updateState(npc);
        this._executeStateActions(world, npc);
    }
    
    _updateTarget(world, npc) {
        let potentialTargets = [];
        if (npc.team === 'enemy') {
            potentialTargets = [world.player, ...world.getAllies()].filter(t => t && !t.isDead);
        } else { // ally
            potentialTargets = world.getEnemies().filter(t => t && !t.isDead);
        }

        let closestTarget = null;
        let minDistanceSq = Infinity;

        for (const target of potentialTargets) {
            const distanceSq = npc.physics.body.position.distanceSquared(target.physics.body.position);
            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                closestTarget = target;
            }
        }
        npc.ai.target = closestTarget;
    }

    _updatePerception(world, npc) {
        const ai = npc.ai;
        ai.perception.distanceToPlayer = npc.physics.body.position.distanceTo(ai.target.physics.body.position);
        
        this._perceptionRayFrom.copy(npc.physics.body.position);
        this._perceptionRayFrom.y += 1.0;
        this._perceptionRayTo.copy(ai.target.physics.body.position);
        this._perceptionRayTo.y += 1.0;

        this._losRayResult.reset();
        world.physics.world.raycastClosest(
            this._perceptionRayFrom, this._perceptionRayTo,
            {
                collisionFilterMask: COLLISION_GROUPS.WORLD | COLLISION_GROUPS.VISION_BLOCKER,
                skipBackfaces: true
            },
            this._losRayResult
        );
        
        ai.perception.hasLineOfSight = !this._losRayResult.hasHit;
        if (ai.perception.hasLineOfSight) {
            ai.lastKnownPlayerPosition.copy(ai.target.physics.body.position);
        }
    }

    _updateState(npc) {
        const ai = npc.ai;
        if (!ai.target) {
            ai.state = 'IDLE';
            return;
        }
    
        // If we can see the target and are close enough, enter combat.
        if (ai.perception.hasLineOfSight && ai.perception.distanceToPlayer < ai.perception.detectionRange) {
            ai.state = 'COMBAT';
        } 
        // If we are in combat but have lost line of sight, start searching.
        else if (ai.state === 'COMBAT' && !ai.perception.hasLineOfSight) {
            ai.state = 'SEARCHING';
        }
        // If we are in combat but the target moved too far away, start searching.
        else if (ai.state === 'COMBAT' && ai.perception.distanceToPlayer > ai.perception.loseSightRange) {
            ai.state = 'SEARCHING';
        }
        // If we were searching and have arrived at the last known position, go idle.
        else if (ai.state === 'SEARCHING' && npc.physics.body.position.distanceTo(ai.lastKnownPlayerPosition) < 2) {
            ai.state = 'IDLE';
        }
    }

    _executeStateActions(world, npc) {
        const { ai } = npc;
        if (ai.isDashing) {
            if (ai.dashStateTimer >= ai.dashDuration) ai.isDashing = false;
            return;
        }
        
        this._faceTarget(npc, ai.lastKnownPlayerPosition);
        if (ai.state === 'COMBAT') this._handleCombatDecisions(world, npc);
    }

    _handleCombatDecisions(world, npc) {
        if (npc.attackType === 'ranged') this._handleRangedCombat(world, npc);
        else if (npc.attackType === 'melee') this._handleMeleeCombat(world, npc);
    }
    
    _handleRangedCombat(world, npc) {
        const { ai, physics } = npc;
        const { distanceToPlayer, hasLineOfSight, attackRange } = ai.perception;

        if (npc.isInWater) {
            this._navigateObstacles(world, npc);
            return;
        }
        
        if (hasLineOfSight && distanceToPlayer <= attackRange && ai.actionTimers.attack <= 0) {
            this._shoot(world, npc, ai.target);
            ai.actionTimers.attack = ai.actionCooldowns.attack;
        }

        this._navigateObstacles(world, npc);
        if (ai.actionTimers.dash <= 0) {
            const toPlayerDir = new CANNON.Vec3().copy(ai.lastKnownPlayerPosition).vsub(physics.body.position);
            const right = new THREE.Vector3().crossVectors(toPlayerDir, CANNON.Vec3.UNIT_Y).normalize();
            ai.dashDirection.copy(right.multiplyScalar(Math.random() > 0.5 ? 1 : -1));
            ai.isDashing = true;
            ai.dashStateTimer = 0;
            ai.actionTimers.dash = ai.actionCooldowns.dash;
        }
    }
    
    _handleMeleeCombat(world, npc) {
        const { ai } = npc;
        const { distanceToPlayer, hasLineOfSight, meleeAttackRange } = ai.perception;

        if (npc.isInWater) {
            this._navigateObstacles(world, npc);
            return;
        }

        if (hasLineOfSight && distanceToPlayer <= meleeAttackRange && ai.actionTimers.meleeAttack <= 0) {
            this._meleeAttack(npc, ai.target);
            ai.actionTimers.meleeAttack = ai.actionCooldowns.meleeAttack;
        }
        this._navigateObstacles(world, npc);
    }
    
    _meleeAttack(npc, target) {
        const config = GAME_CONFIG.NPC.MELEE;
        // A simple check if the target is in front of the NPC
        this._forward.set(0, 0, 1).applyQuaternion(npc.physics.body.quaternion);
        const toTarget = new THREE.Vector3().copy(target.physics.body.position).sub(npc.physics.body.position).normalize();
        
        if (this._forward.dot(toTarget) > 0.7) { // Check if target is roughly in front (cone)
            target.takeDamage(config.DAMAGE);
        }
    }

    _applyMovement(world, npc) {
        const { ai, physics } = npc;

        if (ai.isDashing) {
            const dashSpeed = GAME_CONFIG.NPC.BASE.SPEED * GAME_CONFIG.PLAYER.DASH_SPEED_MULTIPLIER;
            physics.body.velocity.x = ai.dashDirection.x * dashSpeed;
            physics.body.velocity.y = 0; // Dashes are horizontal
            physics.body.velocity.z = ai.dashDirection.z * dashSpeed;
            return;
        }
        
        physics.body.wakeUp();

        let moveDirection = new CANNON.Vec3();
        switch(ai.state) {
            case 'IDLE':
                physics.body.velocity.x *= 0.9;
                physics.body.velocity.z *= 0.9;
                return;
            case 'SEARCHING':
                ai.lastKnownPlayerPosition.vsub(physics.body.position, moveDirection);
                break;
            case 'COMBAT':
                moveDirection = this._getCombatRepositionVector(npc);
                break;
        }

        if (moveDirection.lengthSquared() < 0.01) {
            physics.body.velocity.x *= 0.9;
            physics.body.velocity.z *= 0.9;
            return;
        }

        moveDirection.y = 0; // Movement is planar
        const normalizedMoveDir = moveDirection.clone();
        normalizedMoveDir.normalize();

        if (this._isLedgeAhead(world, npc, normalizedMoveDir)) {
            physics.body.velocity.x = 0;
            physics.body.velocity.z = 0;
        } else {
            const speed = GAME_CONFIG.NPC.BASE.SPEED;
            physics.body.velocity.x = normalizedMoveDir.x * speed;
            physics.body.velocity.z = normalizedMoveDir.z * speed;
        }
    }
    
    _getCombatRepositionVector(npc) {
        const { ai, physics } = npc;
        const { distanceToPlayer, optimalRange, minimumRange, meleeAttackRange } = ai.perception;
        const toPlayerDir = new CANNON.Vec3().copy(ai.lastKnownPlayerPosition).vsub(physics.body.position);

        if (npc.attackType === 'melee') {
            if (distanceToPlayer > meleeAttackRange * 0.8) return toPlayerDir; // Get closer
            return new CANNON.Vec3(); // Stay put
        } else { // Ranged
            if (distanceToPlayer > optimalRange) return toPlayerDir;
            if (distanceToPlayer < minimumRange) return toPlayerDir.negate();
            
            if (ai.actionTimers.reposition <= 0) {
                ai.strafeDirection *= -1;
                ai.actionTimers.reposition = ai.actionCooldowns.reposition;
            }
            return new CANNON.Vec3(toPlayerDir.z, 0, -toPlayerDir.x).scale(ai.strafeDirection);
        }
    }
    
    _navigateObstacles(world, npc) {
        const { physics, ai } = npc;
        if (physics.body.velocity.lengthSquared() < 0.1 || ai.actionTimers.jump <= 0) return;

        const rayFrom = new CANNON.Vec3().copy(physics.body.position);
        
        const velocityDirection = physics.body.velocity.clone();
        velocityDirection.normalize();
        const rayVector = velocityDirection.scale(2);
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
    
    _shoot(world, npc, target) {
        const config = GAME_CONFIG.NPC.RANGED;
        const timeToTarget = npc.ai.perception.distanceToPlayer / config.PROJECTILE_SPEED;
        const predictionTime = Math.min(timeToTarget, 1.0);
        const predictedPosition = new THREE.Vector3().copy(target.physics.body.position).add(
            new THREE.Vector3().copy(target.physics.body.velocity).multiplyScalar(predictionTime)
        );
        predictedPosition.y += 0.5;

        const launchVelocity = Util.calculateBallisticLaunchVelocity(
            new THREE.Vector3().copy(npc.physics.body.position), predictedPosition,
            config.PROJECTILE_SPEED, Math.abs(world.physics.world.gravity.y)
        );

        world.createEnemyProjectile({
            caster: npc,
            initialVelocity: launchVelocity || new THREE.Vector3().subVectors(predictedPosition, npc.physics.body.position).normalize().multiplyScalar(config.PROJECTILE_SPEED)
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
    
    _faceTarget(npc, targetPosition) {
        this._lookAtTarget.copy(targetPosition);
        this._lookAtTarget.y = npc.physics.body.position.y;
        this._tempObject3D.position.copy(npc.physics.body.position);
        this._tempObject3D.lookAt(this._lookAtTarget);
        this._tempQuaternion.copy(this._tempObject3D.quaternion);
        npc.physics.body.quaternion.slerp(this._tempQuaternion, 0.1, npc.physics.body.quaternion);
    }

    _isLedgeAhead(world, npc, moveDirection) {
        const body = npc.physics.body;
        const config = GAME_CONFIG.NPC.BASE;
        const probeDistance = config.RADIUS + 0.2;

        this._ledgeProbePoint.copy(body.position);
        const offset = moveDirection.scale(probeDistance);
        this._ledgeProbePoint.vadd(offset, this._ledgeProbePoint);

        const rayFrom = this._ledgeProbePoint;
        const rayTo = rayFrom.clone();
        rayTo.y -= 3.0; // Check for ground 3m below

        this._ledgeRayResult.reset();
        world.physics.world.raycastClosest(
            rayFrom, rayTo,
            { collisionFilterMask: COLLISION_GROUPS.WORLD },
            this._ledgeRayResult
        );

        return !this._ledgeRayResult.hasHit;
    }
}