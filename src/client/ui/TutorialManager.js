/**
 * Handles the display of tutorial messages.
 * In the new architecture, this class is simplified to be a pure view-layer component.
 * It receives events and displays text via the UIManager/HUD.
 */
export class TutorialManager {
    constructor() {
        this.hudElements = null;
        this.tutorialTimer = null;
    }

    registerHud(hud) {
        this.hudElements = hud.elements;
    }

    // Called by an event listener when a tutorial trigger is activated in the game world.
    onTriggerActivated(data) {
        if (!this.hudElements) return;

        this.showTutorialText(data.message, data.duration);
    }
    
    showTutorialText(message, duration) {
        if (this.tutorialTimer) clearTimeout(this.tutorialTimer);
        
        const container = this.hudElements.tutorialContainer;
        container.classList.remove('level-complete');
        
        this.hudElements.tutorialText.innerHTML = message;
        container.style.opacity = '1';
        container.style.display = 'block';
        
        if (duration > 0) {
            this.tutorialTimer = setTimeout(() => {
                this.hideTutorialText();
            }, duration * 1000);
        }
    }

    hideTutorialText() {
        const container = this.hudElements.tutorialContainer;
        container.style.opacity = '0';
        setTimeout(() => {
            if (!container.classList.contains('level-complete')) {
                 container.style.display = 'none';
            }
        }, 500); // Must match the CSS transition duration
    }
    
    showLevelCompleted() {
        if (this.tutorialTimer) clearTimeout(this.tutorialTimer);
        const container = this.hudElements.tutorialContainer;
        this.hudElements.tutorialText.textContent = 'LEVEL COMPLETE';
        container.classList.add('level-complete');
        container.style.opacity = '1';
        container.style.display = 'block';
    }
}