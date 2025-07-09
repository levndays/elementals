import { AssetEditorApp } from './AssetEditorApp.js';

/**
 * The entry point for the asset editor application.
 * It creates and initializes the main AssetEditorApp instance.
 */
class Main {
    constructor() {
        this.app = new AssetEditorApp();
    }

    async run() {
        try {
            await this.app.init();
        } catch(error) {
            console.error("Failed to initialize the asset editor application:", error);
            document.body.innerHTML = `<div style="color:red; text-align:center; margin-top: 50px;">
                <h1>Asset Editor Failed to Start</h1>
                <p>Please check the console for errors.</p>
            </div>`;
        }
    }
}

const main = new Main();
main.run();