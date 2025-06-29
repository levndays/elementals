import * as THREE from 'three';

export class ParticleExplosion {
    constructor(scene, position, updatables) {
        this.scene = scene;
        this.updatables = updatables; // The central array of objects to update

        this.LIFESPAN = 1.2; // How long the particles last
        this.elapsedTime = 0;
        
        const particleCount = 200;
        const positions = new Float32Array(particleCount * 3);
        this.velocities = [];

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            // All particles start at the center of the explosion
            positions[i3] = 0;
            positions[i3 + 1] = 0;
            positions[i3 + 2] = 0;

            // Create a random direction vector
            const vec = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            );
            vec.normalize();
            // Give it a random speed
            vec.multiplyScalar(Math.random() * 15 + 5); 
            this.velocities.push(vec);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0xff8800,
            size: 0.2,
            transparent: true,
            blending: THREE.AdditiveBlending, // Makes colors add up for a fiery look
            depthWrite: false, // Prevents particles from occluding each other weirdly
        });

        this.points = new THREE.Points(geometry, material);
        this.points.position.copy(position);
        this.scene.add(this.points);

        // Add this particle system to the central update loop
        this.updatables.push(this);
    }

    update(deltaTime) {
        this.elapsedTime += deltaTime;
        const progress = this.elapsedTime / this.LIFESPAN;

        if (progress >= 1) {
            this.cleanup();
            return;
        }

        // Animate particles outward
        const positions = this.points.geometry.attributes.position.array;
        for (let i = 0; i < this.velocities.length; i++) {
            const i3 = i * 3;
            positions[i3] += this.velocities[i].x * deltaTime;
            positions[i3 + 1] += this.velocities[i].y * deltaTime;
            positions[i3 + 2] += this.velocities[i].z * deltaTime;
        }
        this.points.geometry.attributes.position.needsUpdate = true;
        
        // Fade out the particles over their lifespan
        this.points.material.opacity = 1.0 - progress;
    }

    cleanup() {
        // Remove from scene and free memory
        this.scene.remove(this.points);
        this.points.geometry.dispose();
        this.points.material.dispose();

        // Remove self from the central update loop
        const index = this.updatables.indexOf(this);
        if (index > -1) {
            this.updatables.splice(index, 1);
        }
    }
}