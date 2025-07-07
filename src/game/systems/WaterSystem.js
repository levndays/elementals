// src/game/systems/WaterSystem.js
import * as CANNON from 'cannon-es';
import { GAME_CONFIG } from '../../shared/config.js';

export class WaterSystem {
    constructor() {
        // Reusable vector to avoid allocations in the update loop
        this._localEntityPos = new CANNON.Vec3();
    }

    update(world, deltaTime) {
        const waterVolumes = world.getWaterVolumes();
        const entitiesToCheck = [world.player, ...world.getNPCs()];

        if (waterVolumes.length === 0) {
            // Optimization: if no water, quickly reset any entities that might have been in water
            for (const entity of entitiesToCheck) {
                if (entity?.isInWater) {
                    this.removeWaterEffects(entity);
                    entity.isInWater = false;
                    if (entity.type === 'player') entity.currentWaterVolume = null;
                }
            }
            return;
        }

        for (const entity of entitiesToCheck) {
            if (!entity || entity.isDead || !entity.physics?.body) continue;
            
            let isNowInWater = false;
            let currentVolume = null;

            for (const volume of waterVolumes) {
                // Broadphase check first for performance
                if (entity.physics.body.aabb.overlaps(volume.body.aabb)) {
                    
                    const volumeBody = volume.body;

                    // CORRECTED: Use the non-deprecated method name from cannon-es
                    volumeBody.pointToLocalFrame(entity.physics.body.position, this._localEntityPos);

                    const halfSize = volumeBody.shapes[0].halfExtents;
                    
                    // Narrowphase check: is the local point inside the box?
                    if (
                        Math.abs(this._localEntityPos.x) <= halfSize.x &&
                        Math.abs(this._localEntityPos.y) <= halfSize.y &&
                        Math.abs(this._localEntityPos.z) <= halfSize.z
                    ) {
                        isNowInWater = true;
                        currentVolume = volume;
                        break; // Entity is in a volume, no need to check others
                    }
                }
            }
            
            const wasInWater = entity.isInWater || false;

            if (isNowInWater && !wasInWater) {
                this.applyWaterEffects(entity, currentVolume);
            } else if (!isNowInWater && wasInWater) {
                this.removeWaterEffects(entity);
            }
            
            entity.isInWater = isNowInWater;
            if (entity.type === 'player') {
                entity.currentWaterVolume = isNowInWater ? currentVolume : null;
            }
        }
    }

    applyWaterEffects(entity, volume) {
        const body = entity.physics.body;

        if (entity.type === 'player') {
            const surfaceY = volume.body.position.y + volume.definition.size[1] / 2;

            if (entity.isWaterSpecialist) {
                entity.isSwimming = false;
                if (body.position.y <= surfaceY + 0.5) {
                    body.position.y = surfaceY;
                    body.velocity.y = Math.max(0, body.velocity.y);
                    entity.jumpsRemaining = GAME_CONFIG.PLAYER.MAX_JUMPS;
                }
            } else {
                entity.isSwimming = true;
                body.linearDamping = 0.8;
            }
        } else if (entity.type === 'npc') {
            body.linearDamping = 0.8;
        }
    }

    removeWaterEffects(entity) {
        if (entity.type === 'player') {
            entity.isSwimming = false;
            entity.physics.body.linearDamping = GAME_CONFIG.PLAYER.DEFAULT_DAMPING;
        } else if (entity.type === 'npc') {
            entity.physics.body.linearDamping = 0.1;
        }
    }
}