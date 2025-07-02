import { EditorApp } from './EditorApp.js';

/**
 * The entry point for the level editor application.
 * It creates and initializes the main EditorApp instance.
 */
class Main {
    constructor() {
        this.app = new EditorApp();
    }

    async run() {
        try {
            await this.app.init();
        } catch(error) {
            console.error("Failed to initialize the editor application:", error);
            document.body.innerHTML = `<div style="color:red; text-align:center; margin-top: 50px;">
                <h1>Editor Failed to Start</h1>
                <p>Please check the console for errors.</p>
            </div>`;
        }
    }
}

const main = new Main();
main.run();