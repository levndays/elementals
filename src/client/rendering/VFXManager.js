// src/client/rendering/VFXManager.js

import { ParticleExplosion } from './ParticleExplosion.js';
import { DamageNumber } from '../ui/DamageNumber.js';
import { FireballVisual } from './FireballVisual.js';
import { EnemyProjectileVisual } from './EnemyProjectileVisual.js';
import { FireflyProjectileVisual } from './FireflyProjectileVisual.js';
import { WaveVFX } from './WaveVFX.js';
import { MuzzleFlash } from './MuzzleFlash.js';
import { BulletTracer } from './BulletTracer.js';

/**
 * Manages the creation and lifecycle of all visual effects,
 * both DOM-based (CSS animations) and WebGL-based (particles).
 */
export class VFXManager {
    constructor(scene) {
        this.scene = scene;
        this.updatableEffects = [];
        this.entityVisuals = new Map(); // Map<entityId, visualComponent>

        this.domElements = {
            damage: document.getElementById('screen-overlay'),
            dashForward: document.getElementById('vfx-dash-forward'),
            dashSideways: document.getElementById('vfx-dash-sideways'),
            jump: document.getElementById('vfx-jump-wind'),
            slam: document.getElementById('vfx-ground-slam'),
            earthBuff: document.getElementById('vfx-earth-buff'),
        };
        this.setupVFXListeners();
    }

    /**
     * Adds 'animationend' listeners to automatically clean up CSS classes
     * after a DOM-based animation completes.
     */
    setupVFXListeners() {
        Object.values(this.domElements).forEach(element => {
            if (element) {
                element.addEventListener('animationend', () => {
                    // Don't remove 'active' from sustained effects like buffs
                    if (element.id !== 'vfx-earth-buff') {
                        element.classList.remove('active', 'right-to-left', 'left-to-right');
                    }
                });
            }
        });
    }

    /**
     * Triggers a DOM-based visual effect by adding CSS classes to an element.
     * @param {string} elementName - The key for the DOM element (e.g., 'damage', 'dashForward').
     * @param {...string} classes - Additional classes to add, like 'left-to-right'.
     */
    trigger(elementName, ...classes) {
        const element = this.domElements[elementName];
        if (!element) return;
        
        // This pattern reliably restarts a CSS animation
        element.classList.remove('active', 'right-to-left', 'left-to-right');
        void element.offsetWidth; // Force browser reflow
        element.classList.add('active', ...classes);
    }
    
    /**
     * Creates a new particle explosion effect at a given position.
     * @param {THREE.Vector3} position - The world position for the explosion.
     */
    createParticleExplosion(position) {
        const explosion = new ParticleExplosion({ scene: this.scene, position });
        this.updatableEffects.push(explosion);
    }

    /**
     * Creates a new wave visual effect.
     * @param {object} data - Data for the effect.
     * @param {THREE.Vector3} data.position - The starting position.
     * @param {THREE.Vector3} data.direction - The direction the wave travels.
     */
    createWaveEffect(data) {
        const wave = new WaveVFX(this.scene, data.position, data.direction);
        this.updatableEffects.push(wave);
    }

    /**
     * Creates a new damage number effect at a given position.
     * @param {object} data - The data for the damage number.
     * @param {THREE.Vector3} data.position - The world position for the effect.
     * @param {string} data.text - The text to display.
     */
    createDamageNumber({ position, text }) {
        const damageNumber = new DamageNumber({ scene: this.scene, position, text });
        this.updatableEffects.push(damageNumber);
    }
    
    /**
     * Creates muzzle flash and tracer effects for a weapon firing.
     * @param {object} data
     */
    createWeaponFireVFX({ weapon, hitPoint, camera }) {
        const muzzleFlash = new MuzzleFlash({ scene: this.scene, weapon, camera });
        this.updatableEffects.push(muzzleFlash);
        const tracer = new BulletTracer({ scene: this.scene, weapon, hitPoint });
        this.updatableEffects.push(tracer);
    }

    /**
     * Activates a sustained DOM-based visual effect by adding a CSS class.
     * @param {string} elementName - The key for the DOM element.
     */
    activateSustained(elementName) {
        const element = this.domElements[elementName];
        if (element && !element.classList.contains('active')) {
            element.classList.add('active');
        }
    }

    /**
     * Deactivates a sustained DOM-based visual effect by removing a CSS class.
     * @param {string} elementName - The key for the DOM element.
     */
    deactivateSustained(elementName) {
        const element = this.domElements[elementName];
        if (element) {
            element.classList.remove('active');
        }
    }

    createVisualForEntity(entity) {
        if (this.entityVisuals.has(entity.id)) return;

        let visual = null;
        switch (entity.constructor.name) {
            case 'Fireball':
                visual = new FireballVisual(entity, this.scene);
                break;
            case 'EnemyProjectile':
                visual = new EnemyProjectileVisual(entity, this.scene);
                break;
            case 'FireflyProjectile':
                visual = new FireflyProjectileVisual(entity, this.scene);
                break;
        }


        if (visual) {
            this.entityVisuals.set(entity.id, visual);
        }
    }

    removeVisualForEntity(entityId) {
        if (this.entityVisuals.has(entityId)) {
            const visual = this.entityVisuals.get(entityId);
            if (visual.dispose) {
                visual.dispose();
            }
            this.entityVisuals.delete(entityId);
        }
    }

    /**
     * Updates all active programmatic effects and removes any that have finished.
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    update(deltaTime) {
        // Loop backwards to allow for safe removal of elements from the array
        for (let i = this.updatableEffects.length - 1; i >= 0; i--) {
            const effect = this.updatableEffects[i];
            const isAlive = effect.update(deltaTime);
            if (!isAlive) {
                this.updatableEffects.splice(i, 1);
            }
        }

        // Update persistent entity visuals
        for (const visual of this.entityVisuals.values()) {
            if (visual.update) {
                visual.update(deltaTime);
            }
        }
    }
}