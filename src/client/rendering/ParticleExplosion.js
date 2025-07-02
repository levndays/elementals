import * as THREE from 'three';

/**
 * A self-contained, programmatic particle explosion effect.
 * Its lifecycle is managed by the VFXManager.
 */
export class ParticleExplosion {
    constructor({ scene, position }) {
        this.scene = scene;
        this.LIFESPAN = 1.2;
        this.elapsedTime = 0;
        
        const particleCount = 200;
        const positions = new Float32Array(particleCount * 3);
        this.velocities = [];

        for (let i = 0; i < particleCount; i++) {
            const vec = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
            ).normalize().multiplyScalar(Math.random() * 15 + 5);
            this.velocities.push(vec);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0xff8800,
            size: 0.2,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.points = new THREE.Points(geometry, material);
        this.points.position.copy(position);
        this.scene.add(this.points);
    }

    /**
     * Updates the particle positions and opacity.
     * @param {number} deltaTime - Time elapsed since the last frame.
     * @returns {boolean} `false` if the effect is finished, otherwise `true`.
     */
    update(deltaTime) {
        this.elapsedTime += deltaTime;
        const progress = this.elapsedTime / this.LIFESPAN;

        if (progress >= 1) {
            this.cleanup();
            return false; // Signal to VFXManager to remove this effect
        }

        const positions = this.points.geometry.attributes.position.array;
        for (let i = 0; i < this.velocities.length; i++) {
            const i3 = i * 3;
            positions[i3] += this.velocities[i].x * deltaTime;
            positions[i3 + 1] += this.velocities[i].y * deltaTime;
            positions[i3 + 2] += this.velocities[i].z * deltaTime;
        }
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.material.opacity = 1.0 - progress;
        
        return true; // Effect is still active
    }

    /**
     * Removes the effect's assets from the scene and disposes of them.
     */
    cleanup() {
        this.scene.remove(this.points);
        this.points.geometry.dispose();
        this.points.material.dispose();
    }
}