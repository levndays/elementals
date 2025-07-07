import * as THREE from 'three';

const vertexShaderPromise = fetch('./src/client/rendering/shaders/gpu_particle.vert').then(res => res.text());
const fragmentShaderPromise = fetch('./src/client/rendering/shaders/gpu_particle.frag').then(res => res.text());

export class WaterfallSplashVFX {
    constructor(scene, { position, size, normal = new THREE.Vector3(0, 1, 0) }) {
        this.scene = scene;
        this.size = size;
        this.particleCount = 0;
        this.points = null;
        this.isReady = false;
        this.respawnCursor = 0;

        this.init(position, normal);
    }

    async init(position, normal) {
        const particleDensity = 100; // particles per square meter, reduced for performance
        this.particleCount = Math.max(30, Math.floor(particleDensity * this.size.x * this.size.z));

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const velocities = new Float32Array(this.particleCount * 3);
        const lifetimes = new Float32Array(this.particleCount * 4); // maxLifetime, spawnTime, 0, 0

        for (let i = 0; i < this.particleCount; i++) {
            this.initParticle(i, 0, positions, velocities, lifetimes, this.size);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('aLifetime', new THREE.BufferAttribute(lifetimes, 4));

        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.4, 'rgba(200,220,255,0.7)');
        gradient.addColorStop(1, 'rgba(150,200,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        const texture = new THREE.CanvasTexture(canvas);

        const worldGravity = new THREE.Vector3(0, -9.82 * 0.5, 0);
        const localGravity = worldGravity.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal).invert());
        
        const [vertexShader, fragmentShader] = await Promise.all([vertexShaderPromise, fragmentShaderPromise]);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uTexture: { value: texture },
                uColor: { value: new THREE.Color(0xeeeeff) },
                uScale: { value: 2.5 },
                uGravity: { value: localGravity }
            },
            vertexShader,
            fragmentShader,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
        });

        this.points = new THREE.Points(geometry, material);
        this.points.position.copy(position);
        this.points.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.normalize());
        
        this.scene.add(this.points);
        this.isReady = true;
    }

    initParticle(i, currentTime, positions, velocities, lifetimes, size) {
        const i3 = i * 3;
        const i4 = i * 4;
        
        positions[i3] = (Math.random() - 0.5) * size.x;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = (Math.random() - 0.5) * size.z;

        const upwardVelocity = Math.random() * 2.5 + 0.5;
        const scatter = new THREE.Vector3(
            (Math.random() - 0.5) * 0.8,
            upwardVelocity,
            (Math.random() - 0.5) * 0.8
        );

        velocities[i3] = scatter.x;
        velocities[i3 + 1] = scatter.y;
        velocities[i3 + 2] = scatter.z;
        
        const maxLifetime = Math.random() * 2.0 + 0.5;
        lifetimes[i4] = maxLifetime; // maxLifetime
        lifetimes[i4 + 1] = currentTime + Math.random() * maxLifetime; // spawnTime
    }

    update(deltaTime) {
        if (!this.isReady || !this.points) return true;

        const material = this.points.material;
        const currentTime = material.uniforms.uTime.value += deltaTime;

        const lifetimeAttr = this.points.geometry.attributes.aLifetime;
        const positionAttr = this.points.geometry.attributes.position;
        const velocityAttr = this.points.geometry.attributes.velocity;

        let respawned = 0;
        const particlesToRespawn = Math.ceil(this.particleCount * 0.05); // Respawn 5% of particles per frame

        for (let i = 0; i < particlesToRespawn; i++) {
            const index = (this.respawnCursor + i) % this.particleCount;
            const maxLifetime = lifetimeAttr.getX(index);
            const spawnTime = lifetimeAttr.getY(index);

            if (currentTime - spawnTime > maxLifetime) {
                this.initParticle(index, currentTime, positionAttr.array, velocityAttr.array, lifetimeAttr.array, this.size);
                respawned++;
            }
        }

        if (respawned > 0) {
            lifetimeAttr.needsUpdate = true;
            positionAttr.needsUpdate = true;
            velocityAttr.needsUpdate = true;
        }

        this.respawnCursor = (this.respawnCursor + particlesToRespawn) % this.particleCount;
        
        return true; // Never self-destructs
    }

    dispose() {
        if (!this.points) return;
        this.scene.remove(this.points);
        this.points.geometry.dispose();
        this.points.material.uniforms.uTexture.value.dispose();
        this.points.material.dispose();
    }
}