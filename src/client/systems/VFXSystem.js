import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';

/**
 * Listens for abstract gameplay events from the World and translates them
 * into concrete visual effects using the VFXManager.
 */

export class VFXSystem {
    constructor(world, vfxManager) {
        this.world = world;
        this.vfxManager = vfxManager;
        this.hitFlashTimers = new Map(); // entity -> timer
        this.waterfallEffects = new Map(); // Map<entityId, splashVFX[]>

        // Bind handlers to ensure `this` is correct
        this._onEntityAdded = this._onEntityAdded.bind(this);
        this._onEntityRemoved = this._onEntityRemoved.bind(this);

        this.registerListeners();
    }

    registerListeners() {
        this.world.on('entityAdded', this._onEntityAdded);
        this.world.on('entityRemoved', this._onEntityRemoved);
        this.world.on('entityTookDamage', data => this.onEntityTookDamage(data));
        this.world.on('playerDashed', data => this.onPlayerDashed(data));
        this.world.on('playerJumped', () => this.vfxManager.trigger('jump'));
        this.world.on('playerGroundSlammed', () => this.vfxManager.trigger('slam'));
        this.world.on('projectileDetonated', data => this.onProjectileDetonated(data));
        this.world.on('playerBuffActivated', data => this.onPlayerBuffActivated(data));
        this.world.on('playerBuffDeactivated', data => this.onPlayerBuffDeactivated(data));
        this.world.on('playerChannelingUpdate', data => this.onPlayerChannelingUpdate(data));
        this.world.on('wavePowerUsed', data => this.onWavePowerUsed(data));
        this.world.on('weaponFired', data => this.onWeaponFired(data));
    }

    _onEntityAdded({ entity }) {
        this.vfxManager.createVisualForEntity(entity);

        if (entity.type === 'Waterfall') {
            this.createSplashesForWaterfall(entity);
        }
    }

    _onEntityRemoved({ entity }) {
        this.vfxManager.removeVisualForEntity(entity.id);

        if (entity.type === 'Waterfall' && this.waterfallEffects.has(entity.id)) {
            const splashes = this.waterfallEffects.get(entity.id);
            splashes.forEach(splash => splash.dispose());
            this.waterfallEffects.delete(entity.id);
        }
    }

    createSplashesForWaterfall(waterfall) {
        const world = this.world;
        const physicsWorld = world.physics.world;
        const waterfallMesh = waterfall.mesh;
        const width = waterfall.definition.size[0];
        const height = waterfall.definition.size[1];

        const downVector = new THREE.Vector3(0, -1, 0).applyQuaternion(waterfallMesh.quaternion);
        
        const basePosition = waterfallMesh.position.clone().addScaledVector(downVector, height / 2);
        const baseSplash = this.vfxManager.createWaterfallSplashVFX({
            position: basePosition,
            size: { x: width, y: 1.0, z: 2.0 },
            normal: new THREE.Vector3(0, 1, 0)
        });
        
        const allSplashes = [baseSplash];

        const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(waterfallMesh.quaternion);
        const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(waterfallMesh.quaternion);
        const numRays = 15;

        for (let i = 0; i < numRays; i++) {
            const horizontalOffset = (i / (numRays - 1) - 0.5) * width;
            const rayStartPoint = waterfallMesh.position.clone()
                .addScaledVector(upVector, height / 2)
                .addScaledVector(localX, horizontalOffset);
            
            const rayEndPoint = rayStartPoint.clone().addScaledVector(downVector, height);

            const raycastResult = new CANNON.RaycastResult();
            physicsWorld.raycastClosest(
                new CANNON.Vec3().copy(rayStartPoint),
                new CANNON.Vec3().copy(rayEndPoint),
                {
                    collisionFilterGroup: COLLISION_GROUPS.PLAYER_PROJECTILE,
                    collisionFilterMask: COLLISION_GROUPS.WORLD | COLLISION_GROUPS.WATER,
                    skipBackfaces: true
                },
                raycastResult
            );

            if (raycastResult.hasHit) {
                if (raycastResult.hitPointWorld.distanceTo(basePosition) > 1.5) {
                    const hitPoint = new THREE.Vector3().copy(raycastResult.hitPointWorld);
                    const hitNormal = new THREE.Vector3().copy(raycastResult.hitNormalWorld);

                    const intersectionSplash = this.vfxManager.createWaterfallSplashVFX({
                        position: hitPoint,
                        size: { x: width / numRays * 1.5, y: 1.0, z: 1.5 },
                        normal: hitNormal
                    });
                    allSplashes.push(intersectionSplash);
                }
            }
        }
        
        this.waterfallEffects.set(waterfall.id, allSplashes);
    }

    onEntityTookDamage({ entity, amount }) {
        if (!entity || entity.isDead) return;

        const position = entity.physics.body.position.clone();
        position.y += 1.5; // Offset for damage number
        this.vfxManager.createDamageNumber({
            position,
            text: `${Math.floor(amount)}`,
        });

        // Trigger hit flash
        if (entity.mesh?.material) {
            this.hitFlashTimers.set(entity, entity.health.flashDuration);
            if (entity.originalEmissive) {
                entity.mesh.material.emissive.setHex(0xffffff);
            }
        }
        
        if (entity.type === 'player') {
            this.vfxManager.trigger('damage');
        }
    }

    onPlayerDashed({ forwardDot, rightDot }) {
        if (Math.abs(forwardDot) > Math.abs(rightDot)) {
            this.vfxManager.trigger('dashForward');
        } else {
            const directionClass = rightDot > 0 ? 'right-to-left' : 'left-to-right';
            this.vfxManager.trigger('sideways', directionClass);
        }
    }

    onProjectileDetonated({ type, position }) {
        // Here you could switch on `type` for different explosion effects
        this.vfxManager.createParticleExplosion(position);
    }
    
    onWeaponFired(data) {
        this.vfxManager.createWeaponFireVFX({
            ...data,
            camera: this.world.core.renderer.camera
        });
    }

    onPlayerBuffActivated({ buffName }) {
        if (buffName === 'stonePlating') {
            this.vfxManager.activateSustained('earthBuff');
        }
    }

    onPlayerBuffDeactivated({ buffName }) {
        if (buffName === 'stonePlating') {
            this.vfxManager.deactivateSustained('earthBuff');
        }
    }

    onPlayerChannelingUpdate({ isChanneling, ability }) {
        if (ability?.data?.id === 'UTILITY_001') {
            if (isChanneling) {
                this.vfxManager.activateSustained('channelingGlow');
            } else {
                this.vfxManager.deactivateSustained('channelingGlow');
            }
        }
    }

    onWavePowerUsed({ position, direction }) {
        this.vfxManager.createWaveEffect({ position, direction });
    }
    
    update(deltaTime) {
        if (this.hitFlashTimers.size === 0) return;

        for (const [entity, timer] of this.hitFlashTimers.entries()) {
            let newTimer = timer - deltaTime;
            if (newTimer <= 0) {
                if (entity.mesh && entity.originalEmissive) {
                    entity.mesh.material.emissive.copy(entity.originalEmissive);
                }
                this.hitFlashTimers.delete(entity);
            } else {
                const flashProgress = 1 - (newTimer / entity.health.flashDuration);
                if (entity.mesh && entity.originalEmissive) {
                    entity.mesh.material.emissive.lerpColors(new THREE.Color(0xffffff), entity.originalEmissive, flashProgress);
                }
                this.hitFlashTimers.set(entity, newTimer);
            }
        }
    }
    
    dispose() {
        this.world.off('entityAdded', this._onEntityAdded);
        this.world.off('entityRemoved', this._onEntityRemoved);
        
        // Clean up any remaining managed effects
        for (const splashes of this.waterfallEffects.values()) {
            splashes.forEach(splash => splash.dispose());
        }
        this.waterfallEffects.clear();
        this.hitFlashTimers.clear();
    }
}