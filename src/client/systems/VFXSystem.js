import * as THREE from 'three';

/**
 * Listens for abstract gameplay events from the World and translates them
 * into concrete visual effects using the VFXManager.
 */
export class VFXSystem {
    constructor(world, vfxManager) {
        this.world = world;
        this.vfxManager = vfxManager;
        this.hitFlashTimers = new Map(); // entity -> timer

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
        this.world.on('wavePowerUsed', data => this.onWavePowerUsed(data));
    }

    _onEntityAdded({ entity }) {
        this.vfxManager.createVisualForEntity(entity);
    }

    _onEntityRemoved({ entity }) {
        this.vfxManager.removeVisualForEntity(entity.id);
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
        // In a more complex app, you'd unregister other listeners here.
        this.hitFlashTimers.clear();
    }
}