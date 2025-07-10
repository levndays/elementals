import * as THREE from 'three';

/**
 * A controller that manipulates the main camera to simulate a first-person
 * perspective for testing assets.
 */
export class ViewModelCamera {
    constructor(app) {
        this.app = app;
        this.input = app.input;
        this.camera = app.camera; // It controls the main camera now
        this.moveSpeed = 5;
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        
        // Store the camera's state before taking over
        this.originalCameraState = {};
    }

    start() {
        // Save the editor camera's current state
        this.originalCameraState = {
            position: this.camera.position.clone(),
            quaternion: this.camera.quaternion.clone(),
        };

        // Reset for test mode
        this.camera.position.set(0, 1.6, 5);
        this.euler.set(0, 0, 0);
        this.camera.quaternion.setFromEuler(this.euler);
    }

    stop() {
        if (this.originalCameraState.position) {
            this.camera.position.copy(this.originalCameraState.position);
            this.camera.quaternion.copy(this.originalCameraState.quaternion);
        }
    }
    
    update(deltaTime) {
        // --- Look Controls ---
        this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
        this.euler.y -= this.input.mouse.movementX * 0.002;
        this.euler.x -= this.input.mouse.movementY * 0.002;
        this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
        this.camera.quaternion.setFromEuler(this.euler);
        
        // --- Movement Controls ---
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);

        if (this.input.keys['KeyW']) this.camera.position.addScaledVector(forward, this.moveSpeed * deltaTime);
        if (this.input.keys['KeyS']) this.camera.position.addScaledVector(forward, -this.moveSpeed * deltaTime);
        if (this.input.keys['KeyA']) this.camera.position.addScaledVector(right, -this.moveSpeed * deltaTime);
        if (this.input.keys['KeyD']) this.camera.position.addScaledVector(right, this.moveSpeed * deltaTime);

        this.camera.position.y = 1.6; // Keep a fixed height

        // --- Animation Triggers ---
        if (this.input.mouse.leftClick) {
            this.app.animationManager.triggerClip('fire');
        }
        if (this.input.keys['KeyR']) {
            this.app.animationManager.triggerClip('reload');
        }

        this.input.update();
    }
}