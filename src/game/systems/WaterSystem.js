// [ ~ src/game/systems/WaterSystem.js ]
// src/game/systems/WaterSystem.js
import * as CANNON from 'cannon-es';
import { GAME_CONFIG } from '../../shared/config.js';

export class WaterSystem {
    constructor() {
        // Reusable vectors to avoid allocations in the update loop
        this._localEntityPos = new CANNON.Vec3();
        this.buoyantForce = new CANNON.Vec3();
    }

    update(world, deltaTime) {
        const waterVolumes = world.getWaterVolumes();
        const entitiesToCheck = [world.player, ...world.getNPCs()];

        // Part 1: Detect which entities are in water and handle entry/exit effects
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
                if (entity.physics.body.aabb.overlaps(volume.body.aabb)) {
                    const volumeBody = volume.body;
                    volumeBody.pointToLocalFrame(entity.physics.body.position, this._localEntityPos);
                    const halfSize = volumeBody.shapes[0].halfExtents;
                    
                    if (
                        Math.abs(this._localEntityPos.x) <= halfSize.x &&
                        Math.abs(this._localEntityPos.y) <= halfSize.y &&
                        Math.abs(this._localEntityPos.z) <= halfSize.z
                    ) {
                        isNowInWater = true;
                        currentVolume = volume;
                        break;
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

        // Part 2: Apply persistent water physics (buoyancy) to all submerged entities
        for (const entity of entitiesToCheck) {
            if (entity?.isInWater && entity.physics?.body) {
                this.applyBuoyancy(entity, world.physics.world.gravity);
            }
        }
    }
    
    applyBuoyancy(entity, gravity) {
        const body = entity.physics.body;
        // Don't apply buoyancy to water specialists walking on water, as they aren't "submerged".
        if (entity.type === 'player' && entity.isWaterSpecialist) {
            return;
        }
        
        // Force to counteract gravity for neutral buoyancy
        const buoyancyMagnitude = Math.abs(gravity.y) * body.mass;
        
        // Apply some damping to vertical velocity to simulate water resistance
        const verticalDamping = 0.95;
        body.velocity.y *= verticalDamping;
        
        this.buoyantForce.set(0, buoyancyMagnitude, 0);
        body.applyForce(this.buoyantForce, body.position);
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