import * as THREE from 'three';
import { Renderer } from '../engine/Renderer.js';
import { Physics } from '../engine/Physics.js';
import { InputManager } from '../engine/InputManager.js';
import { LevelLoader } from '../world/LevelLoader.js';
import { Player } from './entities/Player.js';
import { HUD } from './ui/HUD.js';
import { TutorialManager } from './ui/TutorialManager.js';

export class Game {
    constructor() {
        this.clock = new THREE.Clock();
        this.renderer = new Renderer();
        this.physics = new Physics();
        this.input = new InputManager();

        this.viewModelScene = new THREE.Scene();

        this.updatables = []; 
        this.activeEffects = [];
        this.levelObjects = [];
        this.enemies = [];

        // --- Game State & UI ---
        this.gameState = 'MENU'; // MENU, LOADING, AWAITING_PLAY, PLAYING, PAUSED, DEAD
        this.respawnTimer = 0;
        this.RESPAWN_COOLDOWN = 5.0;

        this.ui = {
            main: document.getElementById('main-menu'),
            levelSelect: document.getElementById('level-select-menu'),
            pause: document.getElementById('pause-menu'),
            death: document.getElementById('death-screen'),
            levelList: document.getElementById('level-list'),
            respawnTimerText: document.getElementById('respawn-timer-text'),
            loadCustomLevelBtn: document.getElementById('load-custom-level-btn'),
            customLevelInput: document.getElementById('custom-level-input'),
            resumeBtn: document.getElementById('resume-btn'),
            pauseQuitBtn: document.getElementById('pause-quit-btn'),
            deathQuitBtn: document.getElementById('death-quit-btn'),
            playBtn: null, // Will be queried dynamically
            tutorialBtn: null, // Will be queried dynamically
            editorBtn: null, // Will be queried dynamically
        };

        this.currentLevelUrl = null;
        this.currentCustomLevelData = null;
        this.customLevelPlayBtn = null;
    }

    async init() {
        this.levelLoader = new LevelLoader(this);
        
        this.renderer.setupPostProcessing(this.renderer.scene, this.renderer.camera, this.viewModelScene);
        
        this.player = new Player(this.renderer.camera, this.physics.world, this.input, this.viewModelScene, this);
        this.player.isDead = true;

        this.hud = new HUD(this.player, this);
        this.updatables.push(this.hud);
        
        this.tutorialManager = new TutorialManager(this);

        await this.populateLevelList();
        this.setupEventListeners();
        this.returnToMenu(); // Start in the main menu

        this._warmupShaders();
        this.renderer.renderer.setAnimationLoop(() => this.animate());
    }
    
    setupMainMenuListeners() {
        // Get fresh references to buttons that might be recreated
        this.ui.playBtn = document.getElementById('play-btn');
        this.ui.tutorialBtn = document.getElementById('tutorial-btn');
        this.ui.editorBtn = document.getElementById('editor-btn');

        if(this.ui.playBtn) this.ui.playBtn.onclick = () => this.showScreen(this.ui.levelSelect);
        if(this.ui.tutorialBtn) this.ui.tutorialBtn.onclick = () => this.startLevel({ url: './levels/level-tutorial.json' });
        if(this.ui.editorBtn) this.ui.editorBtn.onclick = () => { window.location.href = 'editor.html'; };
    }

    setupEventListeners() {
        this.setupMainMenuListeners();

        this.ui.loadCustomLevelBtn.onclick = () => this.ui.customLevelInput.click();
        this.ui.customLevelInput.onchange = (e) => this.handleCustomLevelSelect(e);

        document.querySelectorAll('.back-button').forEach(btn => 
            btn.onclick = () => this.showScreen(document.getElementById(btn.dataset.target))
        );

        // For unpausing, we just request the lock. The 'pointerlockchange' event handles the rest.
        this.ui.resumeBtn.onclick = () => document.body.requestPointerLock();
        
        this.ui.pauseQuitBtn.onclick = () => this.returnToMenu();
        this.ui.deathQuitBtn.onclick = () => this.returnToMenu();

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                if (this.gameState === 'PAUSED') {
                    // Just request the lock. The 'pointerlockchange' event will handle the rest.
                    document.body.requestPointerLock();
                }
                // If 'PLAYING', the browser's default ESC action will release the lock,
                // which is caught by our 'pointerlockchange' listener to pause the game.
            }
        });

        // REVISED: This is the definitive source of truth for the pointer lock state.
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === document.body) {
                // --- POINTER LOCK GAINED ---
                if (this.gameState === 'PAUSED') {
                    this.gameState = 'PLAYING';
                    this.ui.pause.style.display = 'none';
                    document.body.classList.add('game-active');
                } else if (this.gameState === 'AWAITING_PLAY') {
                    this.startGameplay();
                }
            } else {
                // --- POINTER LOCK LOST ---
                if (this.gameState === 'PLAYING') {
                    this.gameState = 'PAUSED';
                    this.showScreen(this.ui.pause);
                    document.body.classList.remove('game-active');
                } else if (this.gameState === 'AWAITING_PLAY') {
                    // This happens if the user cancels the lock (e.g., hits Esc)
                    // before the game has fully started.
                    this.returnToMenu();
                }
            }
        }, false);
    }

    async populateLevelList() {
        try {
            const response = await fetch('./levels/manifest.json');
            const levels = await response.json();
            this.ui.levelList.innerHTML = '';
            for (const level of levels) {
                // Don't show the tutorial in the regular level list
                if (level.name.toLowerCase() === 'tutorial') continue;
                
                const btn = document.createElement('button');
                btn.textContent = level.name;
                btn.onclick = () => this.startLevel({ url: level.path });
                this.ui.levelList.appendChild(btn);
            }
        } catch (error) {
            console.error("Could not load level manifest:", error);
            this.ui.levelList.innerHTML = '<p style="color: #ff4757;">Could not load levels.</p>';
        }
    }

    showScreen(screenToShow) {
        Object.values(this.ui).forEach(element => {
            if (element instanceof HTMLElement && element.classList.contains('menu-screen')) {
                element.style.display = 'none';
            }
        });
        screenToShow.style.display = 'flex';
    }

    // NEW METHOD: Finalizes the transition into gameplay.
    startGameplay() {
        this.player.spawn(this.levelLoader.getSpawnPoint());
        this.gameState = 'PLAYING';
        
        // Hide all menus
        Object.values(this.ui).forEach(element => {
            if (element instanceof HTMLElement && element.classList.contains('menu-screen')) {
                 element.style.display = 'none';
            }
        });

        document.body.classList.add('game-active');
    }

    // REVISED: Decoupled from immediate pointer lock state.
    async startLevel({ url = null, data = null }) {
        if (!url && !data) {
            console.error("Must provide a level URL or level data.");
            return;
        }

        this.gameState = 'LOADING';
        this.currentLevelUrl = url;
        this.currentCustomLevelData = data;

        this.showScreen(this.ui.main);
        this.ui.main.innerHTML = '<h2>Loading...</h2>';
        
        // Request pointer lock. The 'pointerlockchange' event will handle the transition.
        document.body.requestPointerLock();

        await this.loadLevel(url, data);

        // After loading, we are waiting for the pointer lock to be confirmed.
        this.gameState = 'AWAITING_PLAY';

        // It's possible the lock was acquired while we were loading the level.
        // If so, we can start the game immediately.
        if (document.pointerLockElement === document.body) {
            this.startGameplay();
        }
    }

    handleCustomLevelSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const levelData = JSON.parse(e.target.result);
                this.prepareCustomLevel(levelData);
            } catch (err) {
                alert("Invalid or corrupt level file.");
                console.error("Error parsing custom level:", err);
            } finally {
                event.target.value = ''; 
            }
        };
        reader.readAsText(file);
    }
    
    prepareCustomLevel(data) {
        if (this.customLevelPlayBtn && this.customLevelPlayBtn.parentElement) {
            this.customLevelPlayBtn.parentElement.removeChild(this.customLevelPlayBtn);
        }
    
        const levelName = data.name || 'Custom Level';
        
        this.customLevelPlayBtn = document.createElement('button');
        this.customLevelPlayBtn.textContent = `Play: ${levelName}`;
        this.customLevelPlayBtn.style.borderColor = '#2ed573';
        this.customLevelPlayBtn.onclick = () => this.startLevel({ data });
    
        this.ui.levelList.appendChild(this.customLevelPlayBtn);
    }
    
    handlePlayerDeath() {
        if (this.gameState === 'DEAD') return;
        this.gameState = 'DEAD';
        this.respawnTimer = this.RESPAWN_COOLDOWN;
        this.showScreen(this.ui.death);
        document.body.classList.remove('game-active');
        if (document.pointerLockElement) document.exitPointerLock();
    }
    
    async respawnPlayer() {
        this.gameState = 'LOADING';
        this.ui.death.innerHTML = '<h2>Loading...</h2>';
        
        await this.loadLevel(this.currentLevelUrl, this.currentCustomLevelData);
        
        this.ui.death.innerHTML = `
            <h2>YOU DIED</h2>
            <p id="respawn-timer-text">Respawning in 5...</p>
            <div class="menu-options">
                <button id="death-quit-btn">Return to Menu</button>
            </div>`;
        this.ui.respawnTimerText = document.getElementById('respawn-timer-text');
        this.ui.deathQuitBtn = document.getElementById('death-quit-btn');
        this.ui.deathQuitBtn.onclick = () => this.returnToMenu();
        
        const respawnPos = this.levelLoader.getDeathSpawnPoint() || this.levelLoader.getSpawnPoint();
        this.player.spawn(respawnPos);
        this.gameState = 'PLAYING';
        this.ui.death.style.display = 'none';

        document.body.classList.add('game-active');
        document.body.requestPointerLock();
    }

    returnToMenu() {
        this.gameState = 'MENU';
        this.player.isDead = true;
        this.clearLevel();
        this.showScreen(this.ui.main);
         this.ui.main.innerHTML = `
            <h1>ELEMENTALS</h1>
            <div class="menu-options">
                <button id="play-btn">Play</button>
                <button id="tutorial-btn">How to Play</button>
                <button id="editor-btn">Level Editor</button>
            </div>`;
        this.setupMainMenuListeners();

        if (this.customLevelPlayBtn && this.customLevelPlayBtn.parentElement) {
            this.customLevelPlayBtn.parentElement.removeChild(this.customLevelPlayBtn);
            this.customLevelPlayBtn = null;
        }
        this.currentCustomLevelData = null;

        document.body.classList.remove('game-active');
        if (document.pointerLockElement) document.exitPointerLock();
    }

    async loadLevel(url, data = null) {
        this.clearLevel();
        if (!data) {
            if (!url) throw new Error("loadLevel requires either a URL or data.");
            data = await this.levelLoader.load(url);
        } else {
            // Manually update the level loader's spawn points when loading from a data object.
            this.levelLoader.spawnPoint = data.spawnPoint;
            this.levelLoader.deathSpawnPoint = data.deathSpawnPoint;
        }
        const { levelObjects, enemies } = this.levelLoader.build(data);
        this.levelObjects = levelObjects;
        this.enemies = enemies;
        this.tutorialManager.loadTriggers(data.triggers || []);
    }

    clearLevel() {
        this.tutorialManager.clearTriggers();
        for (const obj of this.levelObjects) {
            this.renderer.scene.remove(obj.mesh);
            obj.mesh.geometry.dispose();
            obj.mesh.material.dispose();
            if(obj.body) this.physics.queueForRemoval(obj.body);
        }
        [...this.enemies].forEach(enemy => enemy.die(true));
        this.levelObjects = [];
        this.enemies = [];
    }

    animate() {
        const deltaTime = this.clock.getDelta();
        
        if (this.gameState === 'PLAYING' || this.gameState === 'PAUSED') {
            this.physics.update(deltaTime);
        }
        
        if (this.gameState === 'PLAYING') {
            for (let i = this.updatables.length - 1; i >= 0; i--) {
                this.updatables[i]?.update(deltaTime);
            }
            this.player.update(deltaTime);
        } else if (this.gameState === 'DEAD') {
            this.respawnTimer -= deltaTime;
            this.ui.respawnTimerText.textContent = `Respawning in ${Math.ceil(this.respawnTimer)}...`;
            if (this.respawnTimer <= 0) {
                this.respawnPlayer();
            }
            this.hud.update(); // Update HUD to show empty bars
        } else if (this.gameState === 'PAUSED') {
             this.hud.update();
        }
        
        this.renderer.render();
    }
    
    _warmupShaders() {
        console.log("Warming up shaders...");
        const scene = this.renderer.scene;
        const offscreenPos = new THREE.Vector3(10000, 10000, 10000);
    
        // Materials to pre-compile
        const materials = [
            // Fireball Material
            new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff4400, emissiveIntensity: 5 }),
            // ParticleExplosion Material
            new THREE.PointsMaterial({ color: 0xff8800, size: 0.1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
            // Enemy Projectile Material
            new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 10 }),
        ];
    
        const dummyGeometry = new THREE.PlaneGeometry(0.01, 0.01);
        const dummyObjects = materials.map(material => {
            const mesh = material.isPointsMaterial 
                ? new THREE.Points(dummyGeometry, material) 
                : new THREE.Mesh(dummyGeometry, material);
            mesh.position.copy(offscreenPos);
            mesh.visible = false;
            scene.add(mesh);
            return { mesh, material };
        });
    
        // Render a single frame to force shader compilation
        this.renderer.render();
    
        // Clean up dummy objects and materials
        dummyObjects.forEach(({ mesh, material }) => {
            scene.remove(mesh);
            material.dispose();
        });
        dummyGeometry.dispose();
    
        console.log("Shaders warmed up.");
    }
}