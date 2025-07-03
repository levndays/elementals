import * as THREE from 'three';

export class MuzzleFlash {
    constructor({ scene, weapon, camera }) {
        this.scene = scene;
        this.lifetime = 0.1;
        this.elapsedTime = 0;
        
        const canvas = this.createCanvas();
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
        
        this.sprite = new THREE.Sprite(material);
        const scale = 0.4 + Math.random() * 0.2;
        this.sprite.scale.set(scale, scale, 1.0);
        this.sprite.material.rotation = Math.random() * Math.PI * 2;
        
        // Position it at the end of the weapon's barrel
        const barrelEndPosition = new THREE.Vector3(0, 0, -0.27); // Local offset from weapon mesh center
        weapon.mesh.localToWorld(barrelEndPosition);
        this.sprite.position.copy(barrelEndPosition);
        
        camera.add(this.sprite); // Add to camera to ensure it's always in viewmodel space
    }

    createCanvas() {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        gradient.addColorStop(0, 'rgba(255, 220, 180, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 180, 50, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        return canvas;
    }

    update(deltaTime) {
        this.elapsedTime += deltaTime;
        if (this.elapsedTime >= this.lifetime) {
            this.cleanup();
            return false; // Signal to VFXManager to remove
        }
        
        const progress = this.elapsedTime / this.lifetime;
        this.sprite.material.opacity = 1.0 - progress;
        this.sprite.scale.x = this.sprite.scale.y = (1.0 - progress) * 0.6;

        return true;
    }

    cleanup() {
        this.sprite.removeFromParent();
        this.sprite.material.map.dispose();
        this.sprite.material.dispose();
    }
}