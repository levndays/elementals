import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class Renderer {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            canvas: document.getElementById('game-canvas')
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // --- PERFORMANCE: Shadow Map Configuration ---
        // Enabling shadows is expensive. Configuring them properly is key.
        this.renderer.shadowMap.enabled = true;
        // PCFSoftShadowMap gives softer, more realistic shadows than the default.
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
        
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        this.bloomPass = null; // Will be initialized in setupPostProcessing

        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupPostProcessing(scene, camera, viewModelScene) {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(scene, camera));

        // Add a separate render pass for the view model (e.g., player hands)
        // This ensures they render on top of the main scene without clipping.
        if (viewModelScene) {
            const viewModelPass = new RenderPass(viewModelScene, camera);
            viewModelPass.clear = false; // Don't clear the color buffer
            viewModelPass.clearDepth = true; // DO clear the depth buffer
            this.composer.addPass(viewModelPass);
        }
        
        // MODIFIED: Tuned bloom pass to be less aggressive.
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        this.bloomPass.threshold = 0.9;
        this.bloomPass.strength = 0.7;
        this.bloomPass.radius = 0.5;
        this.composer.addPass(this.bloomPass);
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    render() {
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}