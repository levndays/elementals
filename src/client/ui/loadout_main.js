// src/client/ui/loadout_main.js
import { LoadoutManager } from './LoadoutManager.js';
import { LoadoutUI } from './LoadoutUI.js';
import { AbilityIconService } from './AbilityIconService.js';

class LoadoutApplication {
    constructor() {
        this.manager = new LoadoutManager();
        this.abilityIconService = new AbilityIconService();
        this.ui = new LoadoutUI(this.manager, this.abilityIconService);
    }

    async init() {
        try {
            await this.manager.init();
            this.ui.init();
        } catch(error) {
            console.error("Failed to initialize Loadout Application:", error);
            document.body.innerHTML = `<div style="color:red; text-align:center; margin-top: 50px;">
                <h1>Loadout Failed to Start</h1>
                <p>Could not load card or player data. Please check console.</p>
            </div>`;
        }
    }
}

const app = new LoadoutApplication();
app.init();