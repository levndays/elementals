import * as THREE from 'three';

export class WaterfallSplashVFX {
    constructor(scene, { position, size, normal = new THREE.Vector3(0, 1, 0) }) {
        this.scene = scene;
        this.lifetime = Infinity; // Lives as long as the waterfall exists
        this.size = size;
        
        const particleDensity = 200; // particles per square meter
        this.particleCount = Math.max(50, Math.floor(particleDensity * this.size.x * this.size.z));

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const velocities = new Float32Array(this.particleCount * 3);
        const lifetimes = new Float32Array(this.particleCount);

        for (let i = 0; i < this.particleCount; i++) {
            this.initParticle(i, positions, velocities, lifetimes, this.size);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.15,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            opacity: 0.6,
            sizeAttenuation: true
        });

        this.points = new THREE.Points(geometry, material);
        this.points.position.copy(position);
        
        const up = new THREE.Vector3(0, 1, 0);
        this.points.quaternion.setFromUnitVectors(up, normal.normalize());
        
        const worldGravity = new THREE.Vector3(0, -9.82 * 0.5, 0);
        this.localGravity = worldGravity.applyQuaternion(this.points.quaternion.clone().invert());

        this.scene.add(this.points);
    }

    initParticle(i, positions, velocities, lifetimes, size) {
        const i3 = i * 3;
        
        positions[i3] = (Math.random() - 0.5) * size.x;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = (Math.random() - 0.5) * size.z;

        const upwardVelocity = Math.random() * 3.0 + 1.0;
        const scatter = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            upwardVelocity,
            (Math.random() - 0.5) * 0.5
        );

        velocities[i3] = scatter.x;
        velocities[i3 + 1] = scatter.y;
        velocities[i3 + 2] = scatter.z;
        
        lifetimes[i] = Math.random() * 2.5 + 0.5;
    }

    update(deltaTime) {
        const positions = this.points.geometry.attributes.position.array;
        const velocities = this.points.geometry.attributes.velocity.array;
        const lifetimes = this.points.geometry.attributes.lifetime.array;
        
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            
            velocities[i3 + 0] += this.localGravity.x * deltaTime;
            velocities[i3 + 1] += this.localGravity.y * deltaTime;
            velocities[i3 + 2] += this.localGravity.z * deltaTime;

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