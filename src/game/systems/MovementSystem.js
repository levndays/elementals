import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GAME_CONFIG } from '../../shared/config.js';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';
        
/**
* Handles player movement based on input, including jumping, dashing, and ground slams.
*/
export class MovementSystem {
    constructor() {
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

        // Reset single-press inputs after they have been processed for the frame.
        player.input.jumpRequested = false;
    }

    _applySwimMovement(player) {
        const { input, physics } = player;
    
        player.isDashing = false;
        player.isSlamming = false;
    
        // Determine if player is at the surface of the water
        let atSurface = false;
        if (player.currentWaterVolume) {
            const body = player.physics.body;
            const volume = player.currentWaterVolume;
            const surfaceY = volume.body.position.y + volume.definition.size[1] / 2;
            
            if (body.position.y >= surfaceY - body.shapes[0].radius) {
                atSurface = true;
            }
        }
        player.isAtWaterSurface = atSurface;
        
        // Prioritize jumping out of the water if requested at the surface
        if (player.input.jumpRequested && atSurface) {
            const body = player.physics.body;
            body.velocity.y = GAME_CONFIG.PLAYER.JUMP_HEIGHT;
            player.world.emit('playerJumped');
            
            player.jumpsRemaining = GAME_CONFIG.PLAYER.MAX_JUMPS;
            
            player.isSwimming = false;
            player.isAtWaterSurface = false;
            player.physics.body.linearDamping = GAME_CONFIG.PLAYER.DEFAULT_DAMPING;
            player.currentWaterVolume = null;
            return; // Exit early, we are no longer swimming
        }
    
        // Apply horizontal movement force
        this._applySwimHorizontalMovement(player);
    
        // Apply vertical movement force (swimming up/down)
        const forceMagnitude = GAME_CONFIG.PLAYER.SWIM_SPEED * GAME_CONFIG.PLAYER.SWIM_FORCE_MULTIPLIER;
        let verticalForce = 0;
        
        if (input.swimDirection > 0) {
            verticalForce = forceMagnitude;
        } else if (input.swimDirection < 0) {
            verticalForce = -forceMagnitude;
        }
        
        if (verticalForce !== 0) {
            this.swimForce.set(0, verticalForce, 0);
            physics.body.applyForce(this.swimForce, physics.body.position);
        }
        
        // Clamp vertical speed
        const maxVerticalSpeed = GAME_CONFIG.PLAYER.SWIM_SPEED * 1.5;
        if (Math.abs(physics.body.velocity.y) > maxVerticalSpeed) {
            physics.body.velocity.y = Math.sign(physics.body.velocity.y) * maxVerticalSpeed;
        }
    }

    /**
     * Applies horizontal movement in water using forces, which allows the physics
     * solver to correctly handle collisions with static objects like logs.
     * @param {import('../entities/Player.js').Player} player 
     */
    _applySwimHorizontalMovement(player) {
        const speed = GAME_CONFIG.PLAYER.SPEED * 0.6; // Water speed modifier
        const body = player.physics.body;
        const moveDirection = player.input.moveDirection;
        
        const targetVelocity = new CANNON.Vec3(
            moveDirection.x * speed,
            body.velocity.y,
            moveDirection.z * speed
        );

        const force = new CANNON.Vec3();
        targetVelocity.vsub(body.velocity, force);
        force.y = 0; // Only apply horizontal force
        force.scale(body.mass * 20, force); // Proportional gain for responsiveness
        body.applyForce(force, body.position);
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
        let speed = GAME_CONFIG.PLAYER.SPEED;
        if (player.statusEffects.has('stonePlating')) {
            speed *= 0.8;
        }
    
        const body = player.physics.body;
        const yVelocity = body.velocity.y; // Preserve vertical velocity from gravity, jumps, etc.
    
        // Directly set the horizontal velocity for responsive control
        body.velocity.x = moveDirection.x * speed;
        body.velocity.z = moveDirection.z * speed;
        
        // Restore the vertical velocity
        body.velocity.y = yVelocity;
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