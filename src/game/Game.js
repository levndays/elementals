import * as THREE from 'three';
import { World } from './world/World.js';
import { PlayerController } from '../client/entities/PlayerController.js';
import { EventEmitter } from '../shared/EventEmitter.js';
import { AbilityFactory } from './abilities/AbilityFactory.js';
import { GAME_CONFIG } from '../shared/config.js';
import { WeaponFactory } from './weapons/WeaponFactory.js';

/**
 * Manages the high-level state of the game application.
 * Acts as a state machine (MENU, LOADING, PLAYING) and orchestrates the core modules,
 * the game world, and the UI manager.
 */
export class Game {
    constructor(core, ui) {
        this.emitter = new EventEmitter(); // Composition
        this.core = core;
        this.ui = ui;
        this.viewModelScene = new THREE.Scene();

        this.gameState = 'MENU';
        this.debugModeActive = false;
        
        this.world = null;
        this.playerController = new PlayerController(this.core.input);
        
        this.respawnTimer = 0;
        this.currentLevelConfig = null;
    }

    // --- Event Emitter Delegation ---
    on(eventName, listener) { this.emitter.on(eventName, listener); }
    emit(eventName, data) { this.emitter.emit(eventName, data); }
    off(eventName, listener) { this.emitter.off(eventName, listener); }
    removeAllListeners() { this.emitter.removeAllListeners(); }

    async init() {
        await AbilityFactory.init();
        this.ui.bindGame(this);
        this._setupEventListeners();
        
        const urlParams = new URLSearchParams(window.location.search);
        this.handleUrlParameters(urlParams);
    }

    handleUrlParameters(params) {
        const loadFromEditor = params.get('loadFromEditor') === 'true';
        const debugMode = params.get('debug') === 'true';
        const showLevelSelect = params.get('showLevelSelect') === 'true';

        if (debugMode) this.toggleDebugMode();

        if (loadFromEditor) {
            const editorLevelData = localStorage.getItem('editorLevelData');
            if (editorLevelData) {
                try {
                    const savedLoadout = JSON.parse(localStorage.getItem('activeLoadout') || '{ "cards": [] }');
                    this.startLevel({ data: JSON.parse(editorLevelData), loadout: savedLoadout });
                } catch (e) {
                    console.error("Failed to parse level data from editor:", e);
                    this.returnToMenu();
                } finally {
                    localStorage.removeItem('editorLevelData');
                }
            }
        } else if (showLevelSelect) {
            this.ui.populateLevelList(this);
            this.ui.showScreen('levelSelect');
        } else {
            this.returnToMenu();
        }
    }

    async startLevel(config) {
        if (this.gameState === 'LOADING') return;

        this.currentLevelConfig = config;
        this.gameState = 'LOADING';
        this.ui.setLoading(true);

        if (this.world) {
            this.world.dispose();
            this.world = null;
        }

        this.world = new World(this.core, this);
        this.emit('worldCreated', this.world);
        
        // Centralize all World event listening here
        this.world.on('playerDied', () => this.handlePlayerDeath());
        this.world.on('npcDied', ({ entity }) => this.world.onNPCDied(entity));
        this.world.on('levelCompleted', () => this.ui.tutorialManager.showLevelCompleted());
        this.world.on('tutorialTriggerActivated', (data) => this.ui.tutorialManager.onTriggerActivated(data));
        this.world.on('abilityCastFailed', (data) => {
            this.emit('abilityCastFailed', data);
        });

        try {
            await this.world.loadLevel(config);

            this.core.renderer.setupPostProcessing(
                this.world.scene,
                this.core.renderer.camera,
                this.viewModelScene
            );

            this.playerController.attach(this.world.player);
            
            this.gameState = 'READY';
            this.ui.showReadyScreen(this.world.levelName);

        } catch (error) {
            console.error("Failed to start level:", error);
            this.returnToMenu();
        }
    }

    startGameplay() {
        if (this.gameState !== 'READY') return;
        this.gameState = 'PLAYING';
        this.ui.setLoading(false);
        this.ui.showScreen('none');
        document.body.classList.add('game-active');

        if (this.world.player.isDead) {
            this.world.player.spawn(this.world.spawnPoint);
        }
    }
    
    handlePlayerDeath() {
        if (this.gameState === 'DEAD') return;
        this.gameState = 'DEAD';
        this.respawnTimer = GAME_CONFIG.UI.RESPAWN_COOLDOWN;
        this.ui.showScreen('deathScreen');
        document.body.classList.remove('game-active');
        if (document.pointerLockElement) document.exitPointerLock();
    }

    respawnPlayer() {
        this.world.resetPlayer();
        this.gameState = 'READY';
        this.ui.showReadyScreen(this.world.levelName);
    }
    
    returnToMenu() {
        if (this.world) {
            this.world.dispose();
            this.world = null;
        }
        this.core.renderer.composer = null;
        this.playerController.detach();
        this.gameState = 'MENU';
        this.ui.setLoading(false);
        this.ui.showScreen('mainMenu');
        document.body.classList.remove('game-active');
        this.emit('mainMenuRendered');
        if (document.pointerLockElement) document.exitPointerLock();
    }
    
    requestPointerLock() {
        this.core.renderer.renderer.domElement.requestPointerLock();
    }

    toggleDebugMode() {
        this.debugModeActive = !this.debugModeActive;
        console.log(`%cDEBUG MODE: ${this.debugModeActive ? 'ACTIVATED' : 'DEACTIVATED'}`, 
            `color: ${this.debugModeActive ? '#2ed573' : '#ff4757'}; font-weight: bold;`);
    }

    _setupEventListeners() {
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement) {
                if (this.gameState === 'READY') this.startGameplay();
                if (this.gameState === 'PAUSED') {
                    this.gameState = 'PLAYING';
                    this.ui.showScreen('none');
                    document.body.classList.add('game-active');
                }
            } else {
                if (this.gameState === 'PLAYING') {
                    this.gameState = 'PAUSED';
                    this.ui.showScreen('pauseMenu');
                    document.body.classList.remove('game-active');
                }
            }
        });

        const setupMainMenuListeners = () => {
            const playBtn = document.getElementById('play-btn');
            const loadoutBtn = document.getElementById('loadout-btn');
            const editorBtn = document.getElementById('editor-btn');
            const assetEditorBtn = document.getElementById('asset-editor-btn');

            if (playBtn) playBtn.onclick = () => {
                this.ui.populateLevelList(this);
                this.ui.showScreen('levelSelect');
            };
            if (loadoutBtn) loadoutBtn.onclick = () => { window.location.href = 'loadout.html'; };
            if (editorBtn) editorBtn.onclick = () => { window.location.href = 'editor.html'; };
            if (assetEditorBtn) assetEditorBtn.onclick = () => { window.location.href = 'asset-editor.html'; };
        };
        
        setupMainMenuListeners();
        this.on('mainMenuRendered', setupMainMenuListeners);

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && this.gameState === 'PLAYING') {
                // Let the pointerlockchange event handle pausing
            }
        });
    }

    update(deltaTime) {
        switch (this.gameState) {
            case 'PLAYING':
                this.world.update(deltaTime);
                break;
            case 'DEAD':
                this.respawnTimer -= deltaTime;
                if (this.respawnTimer <= 0) {
                    this.respawnPlayer();
                }
                break;
        }
    }
}