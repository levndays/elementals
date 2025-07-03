 // src/game/systems/MovementSystem.js
    
    import * as THREE from 'three';
    import * as CANNON from 'cannon-es';
    import { GAME_CONFIG } from '../../shared/config.js';
    import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';
    
    /**
     * Handles player movement based on input, including jumping, dashing, and ground slams.
     */
    export class MovementSystem {
        constructor() {
            // No properties needed for ground check
        }
        
        /**
         * @param {import('../world/World.js').World} world
         * @param {number} deltaTime
         */
        update(world, deltaTime) {
            const player = world.player;
            if (!player || player.isDead) return;
    
            player.physics.body.wakeUp();
    
            const { input, physics } = player;
    
            // Ground checking and jump reset is now handled in Player.js via onCollide
            this._handleCooldowns(player, deltaTime);
            this._handleLook(player);
            this._handleFOV(player, deltaTime);
            
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
            let speed = GAME_CONFIG.PLAYER.SPEED;
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
            
            // This logic mirrors the old implementation correctly now.
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