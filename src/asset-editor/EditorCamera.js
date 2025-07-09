import * as THREE from 'three';

export class EditorCamera {
    constructor(app) {
        this.app = app;
        this.camera = app.camera;
        this.input = app.input;
    }

    update(deltaTime) {
        // Prevent camera movement while transform controls are active or input is disabled
        if (this.app.controls?.transformControls.dragging || !this.input.enabled) {
            this.input.update();
            return;
        }

        const moveSpeed = 10 * deltaTime;
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(this.camera.up, forward).negate();
        
        if (this.input.keys['KeyW']) this.camera.position.addScaledVector(forward, moveSpeed);
        if (this.input.keys['KeyS']) this.camera.position.addScaledVector(forward, -moveSpeed);
        if (this.input.keys['KeyA']) this.camera.position.addScaledVector(right, -moveSpeed);
        if (this.input.keys['KeyD']) this.camera.position.addScaledVector(right, moveSpeed);
        if (this.input.keys['Space']) this.camera.position.y += moveSpeed;
        if (this.input.keys['ShiftLeft']) this.camera.position.y -= moveSpeed;
        
        if (this.input.mouse.rightClick) {
            const euler = new THREE.Euler(0, 0, 0, 'YXZ');
            euler.setFromQuaternion(this.camera.quaternion);
            euler.y -= this.input.mouse.movementX * 0.002;
            euler.x -= this.input.mouse.movementY * 0.002;
            euler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, euler.x));
            this.camera.quaternion.setFromEuler(euler);
        }

        this.input.update();
    }
}