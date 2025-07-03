import * as THREE from 'three';

/**
 * Manages the DOM elements for the in-game Heads-Up Display.
 * This class is a "dumb" view component, updated by the UIManager.
 */
export class HUD {
    constructor(abilityIconService) {
        this.abilityIconService = abilityIconService;
        this.loadedIconUrls = new Map();

        this.elements = {
            healthBar: document.getElementById('health-bar'),
            energyBar: document.getElementById('energy-bar'),
            
            jumpCooldownIndicator: document.getElementById('jump-cooldown-indicator'),
            jumpCooldownProgress: document.getElementById('jump-cooldown-indicator')?.querySelector('.cooldown-progress'),
            dashCooldownIndicator: document.getElementById('dash-cooldown-indicator'),
            dashCooldownProgress: document.getElementById('dash-cooldown-indicator')?.querySelector('.cooldown-progress'),

            abilitySlots: Array.from({ length: 4 }, (_, i) => ({
                element: document.getElementById(`ability-${i}`),
                icon: document.getElementById(`ability-${i}`).querySelector('.ability-icon'),
                cooldownRing: document.getElementById(`ability-${i}`).querySelector('.cooldown-ring-circle'),
                currentElementClass: null,
                isFlashing: false, // State to prevent updates during error animation
            })),
            
            targetFrame: document.getElementById('target-frame'),
            crosshair: document.getElementById('crosshair'),
            tutorialContainer: document.getElementById('tutorial-text-container'),
            tutorialText: document.getElementById('tutorial-text'),
            minimapCanvas: document.getElementById('minimap-canvas'),
            enemyCounter: document.getElementById('enemy-counter'),
            ammoCounter: document.getElementById('ammo-counter'),
            ammoMag: document.getElementById('ammo-mag'),
            ammoReserve: document.getElementById('ammo-reserve'),
        };
        
        this.targetVector = new THREE.Vector3();
        this.RING_CIRCUMFERENCE = 100; // For ability slots
        this.HALF_RING_CIRCUMFERENCE = 157; // For movement cooldowns
    }

    updateResources(health, maxHealth, energy, maxEnergy) {
        const healthPercent = (health / maxHealth) * 100;
        this.elements.healthBar.style.width = `${healthPercent}%`;

        const energyPercent = (energy / maxEnergy) * 100;
        this.elements.energyBar.style.width = `${energyPercent}%`;
    }

    updateMovementCooldowns(jumpTimer, jumpCooldown, dashTimer, dashCooldown, isDoubleJumpOnCooldown, isDashOnCooldown) {
        if (this.elements.jumpCooldownIndicator) {
            const jumpProgress = Math.min(jumpTimer / jumpCooldown, 1.0);
            this.elements.jumpCooldownIndicator.classList.toggle('on-cooldown', isDoubleJumpOnCooldown);
            const offset = this.HALF_RING_CIRCUMFERENCE * (1 - jumpProgress);
            this.elements.jumpCooldownProgress.style.strokeDashoffset = offset;
        }

        if (this.elements.dashCooldownIndicator) {
            const dashProgress = Math.min(dashTimer / dashCooldown, 1.0);
            this.elements.dashCooldownIndicator.classList.toggle('on-cooldown', isDashOnCooldown);
            const offset = this.HALF_RING_CIRCUMFERENCE * (1 - dashProgress);
            this.elements.dashCooldownProgress.style.strokeDashoffset = offset;
        }
    }
    
    _applyIconStyle(element, url) {
        element.style.backgroundImage = `url(${url})`;
        element.style.backgroundColor = 'transparent';
        element.innerHTML = '';
    }

    updateAbilities(abilities, selectedIndex) {
        this.elements.abilitySlots.forEach((slotUI, i) => {
            const ability = abilities[i];

            // Safely manage element-specific class without resetting others
            const newElementClass = ability ? `element-${ability.data.element.toLowerCase()}` : null;
            if (slotUI.currentElementClass && slotUI.currentElementClass !== newElementClass) {
                slotUI.element.classList.remove(slotUI.currentElementClass);
            }
            if (newElementClass && !slotUI.element.classList.contains(newElementClass)) {
                slotUI.element.classList.add(newElementClass);
            }
            slotUI.currentElementClass = newElementClass;

            if (ability) {
                if (!this.loadedIconUrls.has(ability.data.id)) {
                    slotUI.icon.innerHTML = '...';
                    this.loadedIconUrls.set(ability.data.id, 'loading');
                    
                    this.abilityIconService.generate(ability.data).then(iconUrl => {
                        if (iconUrl) {
                            this.loadedIconUrls.set(ability.data.id, iconUrl);
                            // Verify the ability in the slot hasn't changed while the icon was loading
                            if (abilities[i]?.data.id === ability.data.id) {
                                this._applyIconStyle(slotUI.icon, iconUrl);
                            }
                        }
                    });
                } else {
                    const iconUrl = this.loadedIconUrls.get(ability.data.id);
                    if (iconUrl && iconUrl !== 'loading') {
                        this._applyIconStyle(slotUI.icon, iconUrl);
                    } else {
                        slotUI.icon.innerHTML = '...';
                    }
                }

                const cooldownProgress = ability.getCooldownProgress();
                const isReady = cooldownProgress >= 1.0;
                slotUI.element.classList.toggle('ready', isReady);

                // Freeze cooldown progress animation during error flash
                if (!slotUI.isFlashing) {
                    const offset = this.RING_CIRCUMFERENCE * (1 - cooldownProgress);
                    slotUI.cooldownRing.style.strokeDashoffset = offset;
                }
            } else {
                slotUI.icon.style.backgroundImage = 'none';
                slotUI.icon.style.backgroundColor = '';
                slotUI.icon.innerHTML = '';
                slotUI.cooldownRing.style.strokeDashoffset = this.RING_CIRCUMFERENCE;
                slotUI.element.classList.remove('ready');
            }
            
            slotUI.element.classList.toggle('selected', i === selectedIndex);
        });
    }

    updateAmmo(weapon) {
        const ammoCounter = this.elements.ammoCounter;
        if (!ammoCounter) return;

        if (weapon && typeof weapon.magazineAmmo !== 'undefined') {
            ammoCounter.style.display = 'block';
            this.elements.ammoMag.textContent = weapon.magazineAmmo;
            this.elements.ammoReserve.textContent = weapon.reserveAmmo;
            ammoCounter.classList.toggle('reloading', weapon.isReloading);
        } else {
            ammoCounter.style.display = 'none';
        }
    }
    
    updateTargeting(isLockOn, target, camera) {
        this.elements.crosshair.style.opacity = isLockOn ? '0.2' : '1';

        if (isLockOn && target && target.physics?.body) {
            const targetPosition = this.targetVector.copy(target.physics.body.position);
            targetPosition.y += (target.mesh.geometry?.parameters?.height || 2) / 2;
            targetPosition.project(camera);
            
            if (targetPosition.z < 1) {
                const x = (targetPosition.x * 0.5 + 0.5) * window.innerWidth;
                const y = (targetPosition.y * -0.5 + 0.5) * window.innerHeight;
                this.elements.targetFrame.style.display = 'block';
                this.elements.targetFrame.style.left = `${x}px`;
                this.elements.targetFrame.style.top = `${y}px`;
                const distance = camera.position.distanceTo(target.physics.body.position);
                const frameSize = Math.max(30, Math.min(150, 4000 / distance));
                this.elements.targetFrame.style.width = `${frameSize}px`;
                this.elements.targetFrame.style.height = `${frameSize}px`;
            } else {
                this.elements.targetFrame.style.display = 'none';
            }
        } else {
            this.elements.targetFrame.style.display = 'none';
        }
    }
    
    updateEnemyCount(killed, total) {
        if (this.elements.enemyCounter) {
            if (total > 0) {
                this.elements.enemyCounter.style.display = 'block';
                this.elements.enemyCounter.textContent = `ENEMIES: ${total - killed}`;
            } else {
                this.elements.enemyCounter.style.display = 'none';
            }
        }
    }
}