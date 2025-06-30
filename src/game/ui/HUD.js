import * as THREE from 'three';

export class HUD {
    constructor(player, game) {
        this.player = player;
        this.game = game;
        this.overlayElement = document.getElementById('screen-overlay');

        // Resource Bars
        this.healthBarElement = document.getElementById('health-bar');
        this.healthTextElement = document.getElementById('health-text');
        this.energyBarElement = document.getElementById('energy-bar');
        this.energyTextElement = document.getElementById('energy-text');

        // Movement Cooldowns
        this.doubleJumpBarElement = document.getElementById('double-jump-bar');
        this.dashBarElement = document.getElementById('dash-bar');
        
        // Ability Slots
        this.abilitySlots = [];
        for (let i = 0; i < 4; i++) {
            const slot = document.getElementById(`ability-${i}`);
            this.abilitySlots.push({
                element: slot,
                icon: slot.querySelector('.ability-icon'),
                cooldownOverlay: slot.querySelector('.ability-cooldown-overlay'),
            });
        }

        // Target Info Elements
        this.targetInfoElement = document.getElementById('target-info');
        this.targetNameElement = document.getElementById('target-name');
        this.targetHealthBarContainer = document.getElementById('target-health-bar-container');
        this.targetHealthBarElement = document.getElementById('target-health-bar');
        this.targetHealthTextElement = document.getElementById('target-health-text');
        
        // Enemy Counter
        this.enemyCounterElement = document.getElementById('enemy-counter');
        
        // 2D Target Frame Element
        this.targetFrameElement = document.getElementById('target-frame');
        this.targetVector = new THREE.Vector3(); // Re-use vector to avoid GC churn

        // Tutorial Text Elements
        this.tutorialTextContainer = document.getElementById('tutorial-text-container');
        this.tutorialTextElement = document.getElementById('tutorial-text');
        this.tutorialTimer = null;
        
        // Crosshair
        this.crosshairElement = document.getElementById('crosshair');

        if (!this.healthBarElement || !this.energyBarElement || !this.abilitySlots[3].element || !this.targetInfoElement || !this.targetFrameElement || !this.tutorialTextContainer || !this.enemyCounterElement || !this.crosshairElement) {
            console.error("Required HUD elements not found in the DOM!");
        }
    }

    update() {
        if (!this.player) return;
        this.updateResourceBars();
        this.updateMovementCooldowns();
        this.updateAbilitySlots();
        this.updateTargetInfo();
    }

    showTutorialText(message, duration) {
        if (this.tutorialTimer) clearTimeout(this.tutorialTimer);
        this.tutorialTextContainer.classList.remove('level-complete');

        this.tutorialTextElement.innerHTML = message; // Use innerHTML to support kbd tags if needed
        this.tutorialTextContainer.style.opacity = '1';
        this.tutorialTextContainer.style.display = 'block';
        
        this.tutorialTimer = setTimeout(() => {
            this.hideTutorialText();
        }, duration * 1000);
    }
    
    showLevelCompleted() {
        if (this.tutorialTimer) clearTimeout(this.tutorialTimer);
        this.tutorialTextElement.textContent = 'LEVEL COMPLETE';
        this.tutorialTextContainer.classList.add('level-complete');
        this.tutorialTextContainer.style.opacity = '1';
        this.tutorialTextContainer.style.display = 'block';
    }

    hideTutorialText() {
        this.tutorialTextContainer.style.opacity = '0';
        setTimeout(() => {
            // Only hide if it's not the permanent level complete message
            if (!this.tutorialTextContainer.classList.contains('level-complete')) {
                 this.tutorialTextContainer.style.display = 'none';
            }
        }, 500); // Must match the CSS transition duration
    }

    updateEnemyCount(killed, total) {
        if (total > 0) {
            this.enemyCounterElement.style.display = 'block';
            this.enemyCounterElement.textContent = `Enemies: ${killed} / ${total}`;
        } else {
            this.enemyCounterElement.style.display = 'none';
        }
    }

    updateResourceBars() {
        // Health
        const healthPercent = (this.player.currentHealth / this.player.maxHealth) * 100;
        this.healthBarElement.style.width = `${healthPercent}%`;
        this.healthTextElement.textContent = `${Math.ceil(this.player.currentHealth)} / ${this.player.maxHealth}`;

        // Energy
        const energyPercent = (this.player.currentEnergy / this.player.maxEnergy) * 100;
        this.energyBarElement.style.width = `${energyPercent}%`;
        this.energyTextElement.textContent = `${Math.floor(this.player.currentEnergy)} / ${this.player.maxEnergy}`;
        
        if (energyPercent < 25) this.energyBarElement.style.backgroundColor = '#ff4757';
        else if (energyPercent < 50) this.energyBarElement.style.backgroundColor = '#ffa502';
        else this.energyBarElement.style.backgroundColor = '#2ed573';
    }

    updateMovementCooldowns() {
        const djReady = !this.player.doubleJumpOnCooldown;
        this.doubleJumpBarElement.style.width = djReady ? '100%' : `${(this.player.doubleJumpCooldownTimer / this.player.DOUBLE_JUMP_COOLDOWN) * 100}%`;
        djReady && this.player.jumpsRemaining > 0 ? this.doubleJumpBarElement.classList.remove('on-cooldown') : this.doubleJumpBarElement.classList.add('on-cooldown');
        
        const dashReady = !this.player.dashOnCooldown;
        this.dashBarElement.style.width = dashReady ? '100%' : `${(this.player.dashCooldownTimer / this.player.DASH_COOLDOWN) * 100}%`;
        dashReady ? this.dashBarElement.classList.remove('on-cooldown') : this.dashBarElement.classList.add('on-cooldown');
    }

    updateAbilitySlots() {
        for (let i = 0; i < this.abilitySlots.length; i++) {
            const slotUI = this.abilitySlots[i];
            const ability = this.player.abilities[i];

            if (ability) {
                slotUI.icon.textContent = ability.icon;
                const cooldownProgress = ability.getCooldownProgress();
                slotUI.cooldownOverlay.style.height = `${(1 - cooldownProgress) * 100}%`;
            } else {
                slotUI.icon.textContent = '';
                slotUI.cooldownOverlay.style.height = '0%';
            }

            if (i === this.player.selectedAbilityIndex) {
                slotUI.element.classList.add('selected');
            } else {
                slotUI.element.classList.remove('selected');
            }
        }
    }

    updateTargetInfo() {
        const currentAbility = this.player.abilities[this.player.selectedAbilityIndex];
        const isLockOnMode = currentAbility?.requiresLockOn;
        const target = this.player.lockedTarget;

        // Hide crosshair if in lock-on mode, show otherwise
        this.crosshairElement.style.display = isLockOnMode ? 'none' : 'block';

        // Show target frame and info only if in lock-on mode AND a target is acquired
        if (isLockOnMode && target && !target.isDead) {
            // --- Update Target Info Panel ---
            this.targetInfoElement.style.display = 'flex';
            this.targetNameElement.textContent = target.name || 'Enemy';
            
            const healthPercent = (target.currentHealth / target.maxHealth) * 100;
            this.targetHealthBarElement.style.width = `${healthPercent}%`;
            this.targetHealthTextElement.textContent = `${Math.ceil(target.currentHealth)} / ${target.maxHealth}`;

            if (healthPercent < 30) {
                this.targetHealthBarElement.style.backgroundColor = '#ff4757'; // Red
            } else if (healthPercent < 60) {
                this.targetHealthBarElement.style.backgroundColor = '#ffa502'; // Orange
            } else {
                this.targetHealthBarElement.style.backgroundColor = '#2ed573'; // Green
            }

            // --- Update 2D Target Frame ---
            const targetPosition = this.targetVector.copy(target.body.position);
            const enemyHeight = target.mesh.geometry?.parameters?.height || 2;
            targetPosition.y += enemyHeight / 2;
            
            targetPosition.project(this.game.renderer.camera);
            
            if (targetPosition.z < 1) {
                const x = (targetPosition.x * 0.5 + 0.5) * window.innerWidth;
                const y = (targetPosition.y * -0.5 + 0.5) * window.innerHeight;

                this.targetFrameElement.style.display = 'block';
                this.targetFrameElement.style.left = `${x}px`;
                this.targetFrameElement.style.top = `${y}px`;

                const distance = this.player.camera.position.distanceTo(target.body.position);
                const frameSize = Math.max(30, Math.min(150, 4000 / distance)); // Clamp size
                this.targetFrameElement.style.width = `${frameSize}px`;
                this.targetFrameElement.style.height = `${frameSize}px`;
            } else {
                this.targetFrameElement.style.display = 'none';
            }
        } else {
            // Hide all target info if not in lock-on mode or no target
            this.targetInfoElement.style.display = 'none';
            this.targetFrameElement.style.display = 'none';
        }
    }
}