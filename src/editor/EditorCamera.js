import * as THREE from 'three';

export class EditorCamera {
    constructor(editor) {
        this.editor = editor;
        this.camera = editor.camera;
        this.input = editor.input;
    }

    update(deltaTime) {
        // Prevent camera movement while transform controls are active or if input is disabled
        if (this.editor.controls.transformControls.dragging || !this.input.enabled) {
            this.input.update();
            return;
        }

        const moveSpeed = 50 * deltaTime;
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(this.camera.up, forward).negate();
        
        if (this.input.keys['KeyW']) this.camera.position.addScaledVector(forward, moveSpeed);
        if (this.input.keys['KeyS']) this.camera.position.addScaledVector(forward, -moveSpeed);
        if (this.input.keys['KeyA']) this.camera.position.addScaledVector(right, -moveSpeed);
        if (this.input.keys['KeyD']) this.camera.position.addScaledVector(right, moveSpeed);
        if (this.input.keys['Space']) this.camera.position.y += moveSpeed;
        if (this.input.keys['ShiftLeft']) this.camera.position.y -= moveSpeed;
        
        // Right-click look
        if (this.input.mouse.rightClick && !this.input.isClickOnUI(this.input.mouse.screenX, this.input.mouse.screenY)) {
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