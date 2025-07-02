// src/client/ui/UIManager.js
import { HUD } from './HUD.js';
import { Minimap } from '../rendering/Minimap.js';
import { TutorialManager } from './TutorialManager.js';
import { GAME_CONFIG } from '../../shared/config.js';

/**
 * Central controller for all UI interactions, screens, and HUD elements.
 * It acts as the bridge between the game state and the DOM.
 */
export class UIManager {
    constructor(abilityIconService) {
        this.screens = {
            mainMenu: document.getElementById('main-menu'),
            levelSelect: document.getElementById('level-select-menu'),
            pauseMenu: document.getElementById('pause-menu'),
            deathScreen: document.getElementById('death-screen'),
        };

        this.elements = {
            levelList: document.getElementById('level-list'),
            respawnTimerText: document.getElementById('respawn-timer-text'),
            loadCustomLevelBtn: document.getElementById('load-custom-level-btn'),
            customLevelInput: document.getElementById('custom-level-input'),
            resumeBtn: document.getElementById('resume-btn'),
            pauseQuitBtn: document.getElementById('pause-quit-btn'),
            deathQuitBtn: document.getElementById('death-quit-btn'),
        };

        this.hud = new HUD(abilityIconService);
        this.minimap = new Minimap();
        this.tutorialManager = new TutorialManager();
        this.tutorialManager.registerHud(this.hud);

        this.customLevelPlayBtn = null;
    }

    _getLoadout() {
        const saved = localStorage.getItem('activeLoadout');
        return saved ? JSON.parse(saved) : { cards: [null, null, null, null], weapon: null };
    }
    
    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => { if (screen) screen.style.display = 'none' });
        if (this.screens[screenName]) {
            this.screens[screenName].style.display = 'flex';
        }
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.showScreen('mainMenu');
            this.screens.mainMenu.innerHTML = '<h2>Loading...</h2>';
        } else {
            this.screens.mainMenu.innerHTML = `
                <h1>ELEMENTALS</h1>
                <div class="menu-options">
                    <button id="play-btn">Play</button>
                    <button id="loadout-btn">Loadout</button>
                    <button id="editor-btn">Level Editor</button>
                </div>`;
        }
    }

    bindGame(game) {
        const setupMainMenuListeners = () => {
            const playBtn = document.getElementById('play-btn');
            const loadoutBtn = document.getElementById('loadout-btn');
            const editorBtn = document.getElementById('editor-btn');

            if (playBtn) playBtn.onclick = () => {
                this.populateLevelList(game);
                this.showScreen('levelSelect');
            };
            if (loadoutBtn) loadoutBtn.onclick = () => { window.location.href = 'loadout.html'; };
            if (editorBtn) editorBtn.onclick = () => { window.location.href = 'editor.html'; };
        };
        
        setupMainMenuListeners();
        game.on('mainMenuRendered', setupMainMenuListeners);

        this.elements.loadCustomLevelBtn.onclick = () => this.elements.customLevelInput.click();
        this.elements.customLevelInput.onchange = (e) => this.handleCustomLevelSelect(e, game);
        document.querySelectorAll('.back-button').forEach(btn => 
            btn.onclick = () => this.showScreen(btn.dataset.target.replace('-',''))
        );

        this.elements.resumeBtn.onclick = () => game.requestPointerLock();
        this.elements.pauseQuitBtn.onclick = () => game.returnToMenu();
        this.elements.deathQuitBtn.onclick = () => game.returnToMenu();
    }

    async populateLevelList(game) {
        try {
            const response = await fetch('./levels/manifest.json');
            const levels = await response.json();
            this.elements.levelList.innerHTML = '';
            
            for (const level of levels) {
                const btn = document.createElement('button');
                btn.textContent = level.name;
                btn.onclick = () => game.startLevel({ 
                    url: level.path,
                    loadout: this._getLoadout() 
                });
                this.elements.levelList.appendChild(btn);
            }
        } catch (error) {
            console.error("Could not load level manifest:", error);
            this.elements.levelList.innerHTML = '<p style="color: #ff4757;">Could not load levels.</p>';
        }
    }

    handleCustomLevelSelect(event, game) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const levelData = JSON.parse(e.target.result);
                this.prepareCustomLevel(levelData, game);
            } catch (err) {
                alert("Invalid or corrupt level file.");
            } finally {
                event.target.value = ''; 
            }
        };
        reader.readAsText(file);
    }

    prepareCustomLevel(data, game) {
        if (this.customLevelPlayBtn && this.customLevelPlayBtn.parentElement) {
            this.customLevelPlayBtn.parentElement.removeChild(this.customLevelPlayBtn);
        }
        const levelName = data.name || 'Custom Level';
        this.customLevelPlayBtn = document.createElement('button');
        this.customLevelPlayBtn.textContent = `Play: ${levelName}`;
        this.customLevelPlayBtn.style.borderColor = '#2ed573';
        this.customLevelPlayBtn.onclick = () => game.startLevel({ data, loadout: this._getLoadout() });
        this.screens.levelSelect.appendChild(this.customLevelPlayBtn);
    }
    
    update(game) {
        if (!game || !game.world) return;
        
        const player = game.world.player;
        if (!player) return;

        this.hud.updateResources(
            player.health.currentHealth, player.health.maxHealth, 
            player.abilities.currentEnergy, player.abilities.maxEnergy
        );
        this.hud.updateMovementCooldowns(
            player.doubleJumpCooldownTimer, GAME_CONFIG.PLAYER.DOUBLE_JUMP_COOLDOWN,
            player.dashCooldownTimer, GAME_CONFIG.PLAYER.DASH_COOLDOWN,
            player.doubleJumpOnCooldown,
            player.dashOnCooldown
        );
        this.hud.updateAbilities(player.abilities.abilities, player.abilities.selectedAbilityIndex);
        this.hud.updateTargeting(
            player.abilities.abilities[player.abilities.selectedAbilityIndex]?.requiresLockOn, 
            player.lockedTarget,
            game.core.renderer.camera
        );
        this.hud.updateEnemyCount(game.world.enemiesKilled, game.world.initialEnemyCount);
        this.minimap.update(player, game.world.getEnemies(), game.world.getLevelObjects());
        
        if (game.gameState === 'DEAD') {
            this.elements.respawnTimerText.textContent = `Respawning in ${Math.ceil(game.respawnTimer)}...`;
        }
    }
}