// src/client/client_main.js
import * as THREE from 'three';
import { Renderer } from '../core/Renderer.js';
import { Physics } from '../core/Physics.js';
import { InputManager } from '../core/InputManager.js';
import { AssetManager } from '../core/AssetManager.js';
import { Game } from '../game/Game.js';
import { UIManager } from './ui/UIManager.js';
import { VFXManager } from './rendering/VFXManager.js';
import { VFXSystem } from './systems/VFXSystem.js';
import { WorldUISystem } from './systems/WorldUISystem.js';
import { PhysicsSyncSystem } from '../game/systems/PhysicsSyncSystem.js';
import { AbilityIconService } from './ui/AbilityIconService.js';
import { RENDERING_LAYERS } from '../shared/CollisionGroups.js';

class App {
    constructor() {
        this.clock = new THREE.Clock();
        this.core = {};
        this.game = null;
        this.ui = null;
        this.vfxManager = null;
        this.vfxSystem = null;
        this.worldUISystem = null;
        this.physicsSyncSystem = null;
        this.abilityIconService = null;
    }

    async init() {
        // 1. Initialize Core Engine Modules
        const canvas = document.getElementById('game-canvas');
        this.core.clock = this.clock;
        this.core.renderer = new Renderer(canvas);
        this.core.physics = new Physics();
        this.core.input = new InputManager();
        this.core.assets = new AssetManager();
        
        // 2. Initialize UI & VFX Managers
        this.abilityIconService = new AbilityIconService();
        this.ui = new UIManager(this.abilityIconService);
        this.vfxManager = new VFXManager(this.core.renderer.scene);
        
        // 3. Initialize Client-side Systems
        this.physicsSyncSystem = new PhysicsSyncSystem();
        this.worldUISystem = new WorldUISystem(this.core.renderer.scene);
        
        // 4. Initialize Game State Manager
        this.game = new Game(this.core, this.ui);

        // 5. Hook up client-side systems to game events
        this.game.on('worldCreated', (world) => {
            if (this.vfxSystem) this.vfxSystem.dispose();
            
            this.vfxSystem = new VFXSystem(world, this.vfxManager);
            this.worldUISystem.registerWorld(world);
        });

        // 6. Load initial assets, set up game, start loop
        this.core.assets.queue([{
            name: 'npcMannequin',
            type: 'gltf',
            path: 'https://threejs.org/examples/models/gltf/Soldier.glb'
        }]);
        await this.core.assets.loadAll();
        await this.game.init();

        this.core.renderer.renderer.setAnimationLoop(() => this.animate());
    }

    animate() {
        const deltaTime = this.clock.getDelta();
        
        // 1. Process inputs
        if (this.game.world?.player) {
            this.game.playerController.update(deltaTime);
        }

        // 2. Update game logic
        if (this.game.world) {
            this.game.update(deltaTime);
        }

        // 3. Step physics
        this.core.physics.update(deltaTime);
        
        // 4. Sync visuals
        if (this.game.world) {
            this.physicsSyncSystem.update(this.game.world);
        }

        // 5. Update client systems & UI
        this.vfxManager.update(deltaTime);
        this.vfxSystem?.update(deltaTime);
        this.worldUISystem?.update(deltaTime);
        this.ui.update(this.game);

        // 6. Render
        const { renderer, camera, scene, composer } = this.core.renderer;
        
        renderer.autoClear = false;
        renderer.clear();

        // Pass 1: Render the world scene (everything EXCEPT the viewmodel layer).
        camera.layers.enableAll();
        camera.layers.disable(RENDERING_LAYERS.VIEWMODEL);

        if (composer) {
            composer.render(deltaTime);
        } else {
            renderer.render(scene, camera);
        }

        // Pass 2: Render the viewmodel (on its own layer) on top.
        renderer.clearDepth(); // Clear depth buffer to draw weapon on top
        camera.layers.set(RENDERING_LAYERS.VIEWMODEL); // ONLY see the viewmodel
        renderer.render(scene, camera);

        // Reset for next frame
        renderer.autoClear = true;
        camera.layers.enableAll();

        // 7. Reset input deltas
        this.core.input.update();
    }
}

const app = new App();
window.app = app; 
app.init().catch(err => console.error("Application failed to initialize:", err));