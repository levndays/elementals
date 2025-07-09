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
                }
            }
            return;
        }

        for (const entity of entitiesToCheck) {
            if (!entity || entity.isDead || !entity.physics?.body) continue;

            const wasInWater = entity.isInWater || false;
            let isConsideredInWater = false;
            let currentVolumeForFrame = null;
            
            // This logic is only for spherical entities like Player and NPC
            if (entity.physics.body.shapes[0] instanceof CANNON.Sphere) {
                // Broad phase check for potential water interaction
                for (const volume of waterVolumes) {
                    if (entity.physics.body.aabb.overlaps(volume.body.aabb)) {
                        // Precise check: sphere-box intersection test.
                        // 1. Transform sphere center to the box's local frame
                        volume.body.pointToLocalFrame(entity.physics.body.position, this._localEntityPos);
        
                        // 2. Find the closest point on the box AABB (in local coords) to the sphere's center
                        const halfSize = volume.body.shapes[0].halfExtents;
                        const closestPointInBox = new CANNON.Vec3(
                            Math.max(-halfSize.x, Math.min(this._localEntityPos.x, halfSize.x)),
                            Math.max(-halfSize.y, Math.min(this._localEntityPos.y, halfSize.y)),
                            Math.max(-halfSize.z, Math.min(this._localEntityPos.z, halfSize.z))
                        );
        
                        // 3. Check distance squared between sphere center and this closest point
                        const distanceSq = closestPointInBox.distanceSquared(this._localEntityPos);
                        const entityRadius = entity.physics.body.shapes[0].radius;
        
                        if (distanceSq < entityRadius * entityRadius) {
                            isConsideredInWater = true;
                            currentVolumeForFrame = volume;
                            break; // Found a volume, no need to check others
                        }
                    }
                }
            }
            
            if (isConsideredInWater && !wasInWater) {
                this.applyWaterEffects(entity, currentVolumeForFrame);
            } else if (!isConsideredInWater && wasInWater) {
                this.removeWaterEffects(entity);
            }
            
            if (entity.type === 'player') {
                entity.currentWaterVolume = isConsideredInWater ? currentVolumeForFrame : null;
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
        entity.isInWater = true;
        entity.currentWaterVolume = volume;

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
        entity.isInWater = false;
        entity.currentWaterVolume = null;

        if (entity.type === 'player') {
            entity.isSwimming = false;
            entity.isAtWaterSurface = false;
            entity.physics.body.linearDamping = GAME_CONFIG.PLAYER.DEFAULT_DAMPING;
        } else if (entity.type === 'npc') {
            entity.physics.body.linearDamping = 0.1;
        }
    }
}