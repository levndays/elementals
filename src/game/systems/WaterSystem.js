// src/game/systems/WaterSystem.js
import * as CANNON from 'cannon-es';
import { GAME_CONFIG } from '../../shared/config.js';

export class WaterSystem {
    constructor() {
        // No properties needed.
    }

    update(world, deltaTime) {
        const waterVolumes = world.getWaterVolumes();
        const entitiesToCheck = [world.player, ...world.getNPCs()];

        for (const entity of entitiesToCheck) {
            if (!entity || entity.isDead || !entity.physics?.body) continue;
            
            let isNowInWater = false;
            let currentVolume = null;

            if (waterVolumes.length > 0) {
                for (const volume of waterVolumes) {
                    if (entity.physics.body.aabb.overlaps(volume.body.aabb)) {
                        const entityPos = entity.physics.body.position;
                        const volumePos = volume.body.position;
                        const halfSize = volume.body.shapes[0].halfExtents;

                        if (
                            entityPos.x >= volumePos.x - halfSize.x && entityPos.x <= volumePos.x + halfSize.x &&
                            entityPos.y >= volumePos.y - halfSize.y && entityPos.y <= volumePos.y + halfSize.y &&
                            entityPos.z >= volumePos.z - halfSize.z && entityPos.z <= volumePos.z + halfSize.z
                        ) {
                            isNowInWater = true;
                            currentVolume = volume;
                            break;
                        }
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