// src/game/systems/WaterSystem.js
import * as CANNON from 'cannon-es';
import { GAME_CONFIG } from '../../shared/config.js';

export class WaterSystem {
    constructor() {
        // Buoyancy force is removed. We will use damping instead.
    }

    update(world, deltaTime) {
        const waterVolumes = world.getWaterVolumes();
        if (waterVolumes.length === 0) return;
        
        // For now, just check the player. This could be expanded to NPCs.
        const player = world.player;
        if (!player || player.isDead) return;

        this.processEntity(player, waterVolumes);
    }

    processEntity(entity, waterVolumes) {
        const body = entity.physics.body;
        let inWater = false;
        let currentVolume = null;

        for (const volume of waterVolumes) {
            // AABB check is a quick way to see if they *might* be intersecting
            if (body.aabb.overlaps(volume.body.aabb)) {
                // For box triggers, a simple position check is often sufficient and fast
                const entityPos = body.position;
                const volumePos = volume.body.position;
                const halfSize = volume.body.shapes[0].halfExtents;

                if (
                    entityPos.x >= volumePos.x - halfSize.x && entityPos.x <= volumePos.x + halfSize.x &&
                    entityPos.y >= volumePos.y - halfSize.y && entityPos.y <= volumePos.y + halfSize.y &&
                    entityPos.z >= volumePos.z - halfSize.z && entityPos.z <= volumePos.z + halfSize.z
                ) {
                    inWater = true;
                    currentVolume = volume;
                    break;
                }
            }
        }
        
        entity.currentWaterVolume = currentVolume;
        
        if (inWater) {
            this.applyWaterEffects(entity, currentVolume);
        } else if (entity.isSwimming) { // Was swimming, now is not
            this.removeWaterEffects(entity);
        }
    }

    applyWaterEffects(entity, volume) {
        const body = entity.physics.body;
        const surfaceY = volume.body.position.y + volume.definition.size[1] / 2;

        if (entity.isWaterSpecialist) {
            entity.isSwimming = false;
            // Only apply water walking if player is on or just above the surface
            if (body.position.y <= surfaceY + 0.5) {
                body.position.y = surfaceY;
                body.velocity.y = Math.max(0, body.velocity.y);
                entity.jumpsRemaining = GAME_CONFIG.PLAYER.MAX_JUMPS;
            }
        } else {
            // Not a specialist, so they swim. Apply heavy damping for viscous feel.
            entity.isSwimming = true;
            body.linearDamping = 0.8;
        }
    }

    removeWaterEffects(entity) {
        entity.isSwimming = false;
        entity.physics.body.linearDamping = GAME_CONFIG.PLAYER.DEFAULT_DAMPING;
    }
}