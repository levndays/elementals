// [ ~ src/game/systems/MovementSystem.js ]
// ~ src/game/systems/MovementSystem.js

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GAME_CONFIG } from '../../shared/config.js';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';
        
/**
* Handles player movement based on input, including jumping, dashing, and ground slams.
*/
export class MovementSystem {
    constructor() {
        // Add a reusable vector for swim force
        this.swimForce = new CANNON.Vec3();
    }
    
    /**
     * @param {import('../world/World.js').World} world
     * @param {number} deltaTime
     */
    update(world, deltaTime) {
        const player = world.player;
        if (!player || player.isDead) return;

        player.physics.body.wakeUp();

        this._handleCooldowns(player, deltaTime);
        this._handleLook(player);
        this._handleFOV(player, deltaTime);
        
        if (player.isSwimming) {
            this._applySwimMovement(player);
        } else {
            this._applyLandMovement(player, deltaTime);
        }
    }

    _applySwimMovement(player) {
        const { input, physics } = player;
    
        // Dashing is disabled in water
        player.isDashing = false;
    
        // Apply standard horizontal movement (which is already slowed by WaterSystem's damping)
        this._applyStandardMovement(player, input.moveDirection);
    
        // REVISED: Apply force for vertical movement instead of setting velocity directly.
        const forceMagnitude = GAME_CONFIG.PLAYER.SWIM_SPEED * 60; // Force needs to be larger to overcome inertia/damping
        let verticalForce = 0;
        
        if (input.swimDirection > 0) { // Swim up
            verticalForce = forceMagnitude;
        } else if (input.swimDirection < 0) { // Swim down
            verticalForce = -forceMagnitude;
        }
        
        // Only apply force if there's input. Buoyancy from WaterSystem handles the rest.
        if (verticalForce !== 0) {
            this.swimForce.set(0, verticalForce, 0);
            physics.body.applyForce(this.swimForce, physics.body.position);
        }
        
        // Clamp max vertical speed to prevent runaway force accumulation
        const maxVerticalSpeed = GAME_CONFIG.PLAYER.SWIM_SPEED * 1.2;
        if (Math.abs(physics.body.velocity.y) > maxVerticalSpeed) {
            physics.body.velocity.y = Math.sign(physics.body.velocity.y) * maxVerticalSpeed;
        }
    
        // Reset slam state when in water
        player.isSlamming = false;
    }

    _applyLandMovement(player, deltaTime) {
        const { input, physics } = player;
        
        this._initiateDash(player);

        if (player.isSlamming) {
            physics.body.velocity.y = GAME_CONFIG.PLAYER.GROUND_SLAM_VELOCITY;
        } else if (player.isDashing) {
            this._applyDashMovement(player);
        } else {
            this._applyStandardMovement(player, input.moveDirection);
        }
        
        this._handleJump(player);
        this._handleSlam(player);

        // Reset the single-press jump request after processing
        input.jumpRequested = false;
    }
        
    _initiateDash(player) {
        if (player.input.dashRequested && !player.isDashing && !player.dashOnCooldown) {
            player.isDashing = true;
            player.dashOnCooldown = true;
            player.dashStateTimer = 0;
            player.dashCooldownTimer = 0;
            
            const cameraDir = new THREE.Vector3();
            player.camera.getWorldDirection(cameraDir);
            cameraDir.y = 0;
            cameraDir.normalize();
        
            const rightDir = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), cameraDir).normalize();
            
            const forwardDot = player.dashDirection.dot(cameraDir);
            const rightDot = player.dashDirection.dot(rightDir);
    
            player.world.emit('playerDashed', { forwardDot, rightDot });
    
            if (Math.abs(forwardDot) > Math.abs(rightDot)) {
                player.targetFov = GAME_CONFIG.PLAYER.FOV + (forwardDot > 0 ? 15 : -10);
            }
            
            player.input.dashRequested = false;
        }
    }
        
    _handleFOV(player, deltaTime) {
        if (Math.abs(player.camera.fov - player.targetFov) > 0.01) {
            player.camera.fov = THREE.MathUtils.lerp(player.camera.fov, player.targetFov, deltaTime * 10);
            player.camera.updateProjectionMatrix();
        }
        
        if (!player.isDashing && player.targetFov !== GAME_CONFIG.PLAYER.FOV) {
            player.targetFov = GAME_CONFIG.PLAYER.FOV;
        }
    }
        
    _handleCooldowns(player, deltaTime) {
        const config = GAME_CONFIG.PLAYER;
        
        if (player.doubleJumpOnCooldown) {
            player.doubleJumpCooldownTimer += deltaTime;
            if (player.doubleJumpCooldownTimer >= config.DOUBLE_JUMP_COOLDOWN) {
                player.doubleJumpOnCooldown = false;
                player.doubleJumpCooldownTimer = config.DOUBLE_JUMP_COOLDOWN;
            }
        }
        
        if (player.dashOnCooldown) {
            player.dashCooldownTimer += deltaTime;
            if (player.dashCooldownTimer >= config.DASH_COOLDOWN) {
                player.dashOnCooldown = false;
            }
        }
        
        if (player.isDashing) {
            player.dashStateTimer += deltaTime;
            if (player.dashStateTimer >= config.DASH_DURATION) {
                player.isDashing = false;
            }
        }
    }
        
    _handleLook(player) {
        player.camera.quaternion.slerp(player.input.lookDirection, 0.9);
    }
        
    _applyStandardMovement(player, moveDirection) {
        let speed = player.isSwimming ? GAME_CONFIG.PLAYER.SPEED * 0.6 : GAME_CONFIG.PLAYER.SPEED;

        if (player.statusEffects.has('stonePlating')) {
            speed *= 0.8; // Reduce speed by 20%
        }
        
        const velocity = player.physics.body.velocity;
        velocity.x = moveDirection.x * speed;
        velocity.z = moveDirection.z * speed;
    }
        
    _applyDashMovement(player) {
        const dashSpeed = GAME_CONFIG.PLAYER.SPEED * GAME_CONFIG.PLAYER.DASH_SPEED_MULTIPLIER;
        const velocity = player.physics.body.velocity;
        velocity.x = player.dashDirection.x * dashSpeed;
        velocity.z = player.dashDirection.z * dashSpeed;
    }
            
    _handleJump(player) {
        if (!player.input.jumpRequested || player.jumpsRemaining <= 0) return;
        
        const performJump = () => {
            player.physics.body.velocity.y = GAME_CONFIG.PLAYER.JUMP_HEIGHT;
            player.world.emit('playerJumped');
            player.jumpsRemaining--;
        };
        
        if (player.jumpsRemaining === 1 && GAME_CONFIG.PLAYER.MAX_JUMPS === 2) {
            if (!player.doubleJumpOnCooldown) {
                player.doubleJumpOnCooldown = true;
                player.doubleJumpCooldownTimer = 0;
                performJump();
            }
        } else {
            performJump();
        }
    }
            
    _handleSlam(player) {
        const isAirborne = player.jumpsRemaining < GAME_CONFIG.PLAYER.MAX_JUMPS;
        
        if (player.input.slamRequested && !player.isSlamming) {
            if (isAirborne && player.physics.body.velocity.y < 0) {
                player.isSlamming = true;
            }
        } else if (player.isSlamming && !player.input.slamHeld) {
            player.isSlamming = false;
        }
    }
}