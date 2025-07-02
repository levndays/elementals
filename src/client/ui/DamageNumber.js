import * as THREE from 'three';

/**
 * Creates a floating text sprite that displays damage dealt, moves upwards, and fades out.
 * This is a client-side visual effect.
 */
export class DamageNumber {
    constructor({ scene, text, position }) {
        this.scene = scene;

        this.lifetime = 1.0;
        this.elapsedTime = 0;
        this.upwardSpeed = 2.0;

        const canvas = this._createCanvas(text);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        this.sprite = new THREE.Sprite(material);
        this.sprite.renderOrder = 1000;
        this.sprite.scale.set(canvas.width / 100, canvas.height / 100, 1.0);
        this.sprite.position.copy(position);
        this.sprite.position.x += (Math.random() - 0.5) * 0.5;

        this.scene.add(this.sprite);
    }

    _createCanvas(text) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const fontSize = 48;
        context.font = `bold ${fontSize}px Arial`;
        
        const textMetrics = context.measureText(text);
        canvas.width = textMetrics.width + 10;
        canvas.height = fontSize + 10;

        context.font = `bold ${fontSize}px Arial`;
        context.fillStyle = 'rgba(255, 255, 100, 1)';
        context.strokeStyle = 'rgba(0, 0, 0, 1)';
        context.lineWidth = 5;
        context.textAlign = 'center';
        
        const x = canvas.width / 2;
        const y = canvas.height / 2 + fontSize / 3;

        context.strokeText(text, x, y);
        context.fillText(text, x, y);

        return canvas;
    }

    update(deltaTime) {
        this.elapsedTime += deltaTime;
        if (this.elapsedTime >= this.lifetime) {
            this.cleanup();
            return false; // Indicate that this object should be removed
        }

        this.sprite.position.y += this.upwardSpeed * deltaTime;
        this.sprite.material.opacity = 1.0 - (this.elapsedTime / this.lifetime);
        return true; // Still active
    }

    cleanup() {
        this.scene.remove(this.sprite);
        this.sprite.material.map.dispose();
        this.sprite.material.dispose();
    }
}