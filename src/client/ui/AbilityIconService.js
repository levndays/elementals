// src/client/ui/AbilityIconService.js
import * as THREE from 'three';

/**
 * A reusable service for generating and caching 2D icons of ability sigils.
 */
export class AbilityIconService {
    constructor() {
        this.cache = new Map();
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.plane = null;
        this.sigilShader = null;
        this.isInitialized = false;
    }

    /**
     * Sets up the offscreen WebGL context for rendering icons.
     * @private
     */
    async _initialize() {
        if (this.isInitialized) return;

        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        this.camera.position.z = 1;
        this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });

        this.plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
        this.scene.add(this.plane);

        const fragShaderSource = await fetch('./src/client/rendering/shaders/sigil.frag').then(res => res.text());
        this.sigilShader = {
            vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
            fragmentShader: fragShaderSource,
        };
        
        this.isInitialized = true;
    }

    /**
     * Generates a data URL for a given ability's sigil icon.
     * @param {object} abilityData - The full data object for the ability.
     * @returns {Promise<string|null>} A promise that resolves to the data URL of the icon.
     */
    async generate(abilityData) {
        if (!this.isInitialized) await this._initialize();
        if (!abilityData || !abilityData.id) return null;

        if (this.cache.has(abilityData.id)) {
            return this.cache.get(abilityData.id);
        }

        const elementMap = { Fire: 0, Water: 1, Air: 2, Earth: 3, Utility: 4 };
        const elementColors = { 
            Fire: new THREE.Color(0xFF771A), 
            Water: new THREE.Color(0x00A3FF), 
            Air: new THREE.Color(0xB3FCFC), 
            Earth: new THREE.Color(0xB39159), 
            Utility: new THREE.Color(0xA16BFF), 
            Default: new THREE.Color(0xFFFFFF)
        };

        const elementId = elementMap[abilityData.element] ?? 5;
        const elementColor = elementColors[abilityData.element] || elementColors.Default;

        this.plane.material = new THREE.ShaderMaterial({
            ...this.sigilShader,
            uniforms: {
                uElementId: { value: elementId },
                uElementColor: { value: elementColor },
            },
            transparent: true,
        });

        this.renderer.render(this.scene, this.camera);
        const dataUrl = this.renderer.domElement.toDataURL();
        
        // Clean up the material
        if (this.plane.material.dispose) {
            this.plane.material.dispose();
        }

        this.cache.set(abilityData.id, dataUrl);
        return dataUrl;
    }
}