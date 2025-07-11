import * as THREE from 'three';
import { GAME_CONFIG } from '../../shared/config.js';

/**
 * Handles client-side player input and translates it into commands for the player entity.
 * This class acts as the bridge between the InputManager and the player's state/actions.
 */
export class PlayerController {
    constructor(inputManager) {
        this.input = inputManager;
        this.player = null; // Will be attached by the game state

        // --- Internal State for Input Processing ---
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.keyLastPress = {};
        this.keyPreviousState = {};
        this.isRightMouseDown = false;
        
        // --- PERFORMANCE: Reusable Vectors ---
        this._forward = new THREE.Vector3();
        this._right = new THREE.Vector3();
        this._moveDirection = new THREE.Vector3();
        this._upVector = new THREE.Vector3(0, 1, 0);
        
        // --- Event Handlers ---
        this._onSinglePress = this._onSinglePress.bind(this);
        this._onScroll = this._onScroll.bind(this);
    }

    /**
     * Attaches the controller to a specific player entity.
     * @param {Player} player - The player entity to control.
     */
    attach(player) {
        this.player = player;
        // Sync the controller's euler angles with the player's camera on attach
        this.euler.setFromQuaternion(this.player.camera.quaternion);
        this.input.on('singlePress', this._onSinglePress);
        this.input.on('scroll', this._onScroll);
    }

    /**
     * Detaches the controller from the player entity.
     */
    detach() {
        this.input.off('singlePress', this._onSinglePress);
        this.input.off('scroll', this._onScroll);
        this.player = null;
    }

    /**
     * Called every frame to process inputs and update the attached player.
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    update(deltaTime) {
        if (!this.player || this.player.isDead || !document.pointerLockElement) {
            if (this.isRightMouseDown) {
                this.player.stopUsingAbility();
                this.isRightMouseDown = false;
            }
            return;
        }

        this._handleLook();
        this._handleMovement(deltaTime);
        this._handleActions();
    }

    /**
     * Processes mouse movement to update the player's view direction.
     */
    _handleLook() {
        const PI_2 = Math.PI / 2;
        this.euler.y -= this.input.mouse.movementX * 0.002;
        this.euler.x -= this.input.mouse.movementY * 0.002;
        this.euler.x = Math.max(-PI_2, Math.min(PI_2, this.euler.x));
        
        this.player.setLookDirection(this.euler);
    }

    /**
     * Processes keyboard inputs for movement, jumping, and dashing.
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    _handleMovement(deltaTime) {
        const xInput = (this.input.keys['KeyD'] ? 1 : 0) - (this.input.keys['KeyA'] ? 1 : 0);
        const zInput = (this.input.keys['KeyW'] ? 1 : 0) - (this.input.keys['KeyS'] ? 1 : 0);

        this.player.camera.getWorldDirection(this._forward);
        this._forward.y = 0;
        this._forward.normalize();
        
        // The "right" vector is the cross product of forward and up.
        this._right.crossVectors(this._forward, this._upVector).normalize();

        this._moveDirection.set(0, 0, 0);
        if (zInput) this._moveDirection.add(this._forward.clone().multiplyScalar(zInput));
        if (xInput) this._moveDirection.add(this._right.clone().multiplyScalar(xInput));
        
        if (this._moveDirection.lengthSq() > 0) {
            this._moveDirection.normalize();
        }

        this.player.setMoveDirection(this._moveDirection);
        
        if (this.player.isSwimming) {
            let swimDirection = 0;
            if (this.input.keys['Space']) swimDirection = 1;
            else if (this.input.keys['ShiftLeft']) swimDirection = -1;
            this.player.requestSwim(swimDirection);
            this.player.requestSlam(false);
        } else {
            // Only handle dash and slam on land/in air
            this._handleDashInput();
            if (this.input.keys['ShiftLeft']) {
                this.player.requestSlam(true);
            } else {
                this.player.requestSlam(false);
            }
            // Ensure swim is neutral when not in water
            this.player.requestSwim(0);
        }
    }

    /**
     * Checks for double-tap inputs to trigger a dash.
     */
    _handleDashInput() {
        const now = performance.now();
        ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach(key => {
            const isPressed = this.input.keys[key];
            if (isPressed && !this.keyPreviousState[key]) {
                if (now - (this.keyLastPress[key] || 0) < GAME_CONFIG.PLAYER.DOUBLE_TAP_WINDOW) {
                    // Pass the current intended move direction to the dash function
                    this.player.dash(this._moveDirection);
                }
                this.keyLastPress[key] = now;
            }
            this.keyPreviousState[key] = isPressed;
        });
    }
    
    _onSinglePress(event) {
        if (!this.player || this.player.isDead || !document.pointerLockElement) return;
        
        if (event.code === 'Space') {
            // Let the MovementSystem decide what a jump means based on state (land vs water)
            this.player.jump();
        }
        
        if (event.code === 'KeyR') {
            this.player.reloadWeapon();
        }

        if (event.code === 'KeyF') {
            this.player.inspectWeapon();
        }
    }

    _onScroll(event) {
        if (!this.player || this.player.isDead || !document.pointerLockElement) return;
    
        // Positive deltaY means scrolling down/forward, negative means up/backward
        const direction = Math.sign(event.deltaY);
        this.player.cycleAbility(direction);
    }

    /**
     * Processes mouse clicks and number keys for attacks and ability selection.
     */
    _handleActions() {
        if (this.input.mouse.leftClick) {
            this.player.weapon?.attack();
        }

        if (this.input.mouse.rightClick) {
            if (!this.isRightMouseDown) {
                // First frame of press
                this.player.startUsingAbility();
                this.isRightMouseDown = true;
            }
        } else {
            if (this.isRightMouseDown) {
                // First frame of release
                this.player.stopUsingAbility();
                this.isRightMouseDown = false;
            }
        }

        for (let i = 1; i <= 4; i++) {
            if (this.input.keys[`Digit${i}`]) {
                this.player.selectAbility(i - 1);
            }
        }
    }
}