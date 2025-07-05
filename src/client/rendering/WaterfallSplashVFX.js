// src/client/rendering/WaterfallSplashVFX.js
import * as THREE from 'three';

export class WaterfallSplashVFX {
    constructor(scene, position, size) {
        this.scene = scene;
        this.lifetime = Infinity; // Lives as long as the waterfall exists
        this.particleCount = 400;

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const velocities = new Float32Array(this.particleCount * 3);
        const lifetimes = new Float32Array(this.particleCount);

        for (let i = 0; i < this.particleCount; i++) {
            this.initParticle(i, positions, velocities, lifetimes, size);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.2,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            opacity: 0.7,
            sizeAttenuation: true
        });

        this.points = new THREE.Points(geometry, material);
        this.points.position.copy(position);
        this.size = size;

        this.scene.add(this.points);
    }

    initParticle(i, positions, velocities, lifetimes, size) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * size.x;
        positions[i3 + 1] = Math.random() * 2.0;
        positions[i3 + 2] = (Math.random() - 0.5) * size.z;

        velocities[i3] = (Math.random() - 0.5) * 0.5;
        velocities[i3 + 1] = Math.random() * 3.0 + 1.0;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.5;
        
        lifetimes[i] = Math.random() * 2.5 + 0.5;
    }

    update(deltaTime) {
        const positions = this.points.geometry.attributes.position.array;
        const velocities = this.points.geometry.attributes.velocity.array;
        const lifetimes = this.points.geometry.attributes.lifetime.array;
        
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            
            velocities[i3 + 1] -= 9.82 * deltaTime * 0.5; // Gravity

            positions[i3] += velocities[i3] * deltaTime;
            positions[i3 + 1] += velocities[i3 + 1] * deltaTime;
            positions[i3 + 2] += velocities[i3 + 2] * deltaTime;
            
            lifetimes[i] -= deltaTime;
            if (lifetimes[i] <= 0) {
                this.initParticle(i, positions, velocities, lifetimes, this.size);
            }
        }

        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.velocity.needsUpdate = true;
        this.points.geometry.attributes.lifetime.needsUpdate = true;
        
        return true; // Never self-destructs
    }

    dispose() {
        this.scene.remove(this.points);
        this.points.geometry.dispose();
        this.points.material.dispose();
    }
}