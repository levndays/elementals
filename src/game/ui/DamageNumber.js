import * as THREE from 'three';

/**
 * Creates a floating text sprite that displays damage dealt, moves upwards, and fades out.
 */
export class DamageNumber {
    constructor({ game, position, text }) {
        this.game = game;
        this.scene = game.renderer.scene;
        this.camera = game.renderer.camera;

        this.lifetime = 1.0;
        this.elapsedTime = 0;
        this.upwardSpeed = 2.0;

        const canvas = this.createCanvas(text);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        this.sprite = new THREE.Sprite(material);
        this.sprite.renderOrder = 1000; // Render on top of most things
        this.sprite.scale.set(canvas.width / 100, canvas.height / 100, 1.0);
        this.sprite.position.copy(position);
        
        // Add some random horizontal offset to prevent perfect stacking
        this.sprite.position.x += (Math.random() - 0.5) * 0.5;

        this.scene.add(this.sprite);
        this.game.updatables.push(this);
    }

    /**
     * Creates a canvas element with the styled damage text.
     * @param {string} text - The text to draw.
     * @returns {HTMLCanvasElement}
     */
    createCanvas(text) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const fontSize = 48;
        context.font = `bold ${fontSize}px Arial`;
        
        const textMetrics = context.measureText(text);
        canvas.width = textMetrics.width + 10;
        canvas.height = fontSize + 10;

        // Canvas context is reset on resize, so re-apply font and styles
        context.font = `bold ${fontSize}px Arial`;
        context.fillStyle = 'rgba(255, 255, 100, 1)'; // Yellowish color for damage
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
            return;
        }

        // Move upwards
        this.sprite.position.y += this.upwardSpeed * deltaTime;

        // Fade out
        const progress = this.elapsedTime / this.lifetime;
        this.sprite.material.opacity = 1.0 - progress;
    }

    cleanup() {
        this.scene.remove(this.sprite);
        this.sprite.material.map.dispose();
        this.sprite.material.dispose();

        const index = this.game.updatables.indexOf(this);
        if (index > -1) {
            this.game.updatables.splice(index, 1);
        }
    }
}