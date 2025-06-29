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
        this.gameState = 'MENU'; // MENU, LOADING, PLAYING, PAUSED, DEAD
        this.respawnTimer = 0;
        this.RESPAWN_COOLDOWN = 5.0;

        this.ui = {
            main: document.getElementById('main-menu'),
            levelSelect: document.getElementById('level-select-menu'),
            pause: document.getElementById('pause-menu'),
            death: document.getElementById('death-screen'),
            levelList: document.getElementById('level-list'),
            respawnTimerText: document.getElementById('respawn-timer-text'),
            playBtn: document.getElementById('play-btn'),
            tutorialBtn: document.getElementById('tutorial-btn'),
            resumeBtn: document.getElementById('resume-btn'),
            pauseQuitBtn: document.getElementById('pause-quit-btn'),
            deathQuitBtn: document.getElementById('death-quit-btn'),
        };

        this.currentLevelUrl = null;
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

    setupEventListeners() {
        this.ui.playBtn.onclick = () => this.showScreen(this.ui.levelSelect);
        this.ui.tutorialBtn.onclick = () => this.startGame('./levels/level-tutorial.json');

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

        // This is the definitive source of truth for the pointer lock state.
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === document.body) {
                // We just GAINED pointer lock.
                if (this.gameState === 'PAUSED') {
                    this.gameState = 'PLAYING';
                    this.ui.pause.style.display = 'none';
                    document.body.classList.add('game-active');
                }
            } else {
                // We just LOST pointer lock.
                if (this.gameState === 'PLAYING') {
                    this.gameState = 'PAUSED';
                    this.showScreen(this.ui.pause);
                    document.body.classList.remove('game-active');
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
                btn.onclick = () => this.startGame(level.path);
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

    async startGame(levelUrl) {
        this.gameState = 'LOADING';
        this.currentLevelUrl = levelUrl;
        
        document.body.requestPointerLock();

        this.showScreen(this.ui.main);
        this.ui.main.innerHTML = '<h2>Loading...</h2>';

        await this.loadLevel(levelUrl);

        if (document.pointerLockElement !== document.body) {
            this.returnToMenu();
            return;
        }
        
        this.player.spawn(this.levelLoader.getSpawnPoint());
        this.gameState = 'PLAYING';
        
        Object.values(this.ui).forEach(element => {
            if (element instanceof HTMLElement && element.classList.contains('menu-screen')) {
                 element.style.display = 'none';
            }
        });

        document.body.classList.add('game-active');
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
        
        await this.loadLevel(this.currentLevelUrl);
        
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
            </div>`;
        this.ui.playBtn = document.getElementById('play-btn');
        this.ui.tutorialBtn = document.getElementById('tutorial-btn');
        this.ui.playBtn.onclick = () => this.showScreen(this.ui.levelSelect);
        this.ui.tutorialBtn.onclick = () => this.startGame('./levels/level-tutorial.json');
        document.body.classList.remove('game-active');
        if (document.pointerLockElement) document.exitPointerLock();
    }

    async loadLevel(levelUrl) {
        this.clearLevel();
        const levelData = await this.levelLoader.load(levelUrl);
        const { levelObjects, enemies } = this.levelLoader.build(levelData);
        this.levelObjects = levelObjects;
        this.enemies = enemies;
        this.tutorialManager.loadTriggers(levelData.triggers || []);
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