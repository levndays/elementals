import * as THREE from 'three';

// Asynchronously load shaders once at the module level
const vertexShaderPromise = fetch('./src/client/rendering/shaders/gpu_particle.vert').then(res => res.text());
const fragmentShaderPromise = fetch('./src/client/rendering/shaders/gpu_particle.frag').then(res => res.text());

export class CardParticleSystem {
    constructor(scene, element) {
        this.scene = scene;
        this.element = element;
        this.isStreamType = ['Air', 'Water'].includes(this.element);
        this.isReady = false;
        this.points = null;
        this.streamGroup = null;

        this.init();
    }

    async init() {
        if (this.isStreamType) {
            this.initStreamSystem();
        } else {
            await this.initPointSystem();
        }
        this.isReady = true;
    }

    initStreamSystem() {
        this.streamGroup = new THREE.Group();
        this.streams = [];
        const streamMaterial = new THREE.MeshBasicMaterial({ map: this.createStreamTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: this.element === 'Air' ? 0xB3FCFC : 0x00A3FF });
        const streamGeometry = new THREE.PlaneGeometry(1, 1);
        for (let i = 0; i < 50; i++) {
            const streamMesh = new THREE.Mesh(streamGeometry, streamMaterial.clone());
            streamMesh.userData.velocity = new THREE.Vector3();
            streamMesh.userData.phase = Math.random() * Math.PI * 2;
            this.initStreamParticle(streamMesh);
            this.streams.push(streamMesh);
            this.streamGroup.add(streamMesh);
        }
        this.scene.add(this.streamGroup);
    }
    
    async initPointSystem() {
        this.particleCount = 150;
        this.respawnCursor = 0;
        const elementColors = { Fire: new THREE.Color('#FF771A'), Earth: new THREE.Color('#B39159'), Utility: new THREE.Color('#A16BFF'), Default: new THREE.Color('#FFFFFF') };
        this.color = elementColors[this.element] || elementColors.Default;
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const velocities = new Float32Array(this.particleCount * 3);
        const lifetimes = new Float32Array(this.particleCount * 4); // maxLifetime, spawnTime, 0, 0

        for (let i = 0; i < this.particleCount; i++) {
            this.initPointParticle(i, 0, positions, velocities, lifetimes);
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('aLifetime', new THREE.BufferAttribute(lifetimes, 4));

        const [vertexShader, fragmentShader] = await Promise.all([vertexShaderPromise, fragmentShaderPromise]);
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uTexture: { value: this.createPointTexture() },
                uColor: { value: this.color },
                uScale: { value: 2.0 }
            },
            vertexShader,
            fragmentShader,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true
        });

        this.points = new THREE.Points(geometry, material);
        this.scene.add(this.points);
    }

    initPointParticle(i, currentTime, positions, velocities, lifetimes) {
        const i3 = i * 3;
        const i4 = i * 4;

        positions[i3] = (Math.random() - 0.5) * 2;
        positions[i3 + 1] = (Math.random() - 0.5) * 1.5 - 1.0;
        positions[i3 + 2] = (Math.random() - 0.5) * 0.5;

        velocities[i3] = (Math.random() - 0.5) * 0.1;
        velocities[i3 + 1] = Math.random() * 0.4 + 0.2;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;

        lifetimes[i4] = Math.random() * 3.0 + 1.0; // maxLifetime
        lifetimes[i4 + 1] = currentTime + Math.random() * lifetimes[i4]; // spawnTime (staggered)
    }

    initStreamParticle(stream) {
        const lifetime = Math.random() * 3.0 + 2.5;
        stream.userData.lifetime = stream.userData.initialLifetime = lifetime;
        stream.position.set((Math.random() - 0.5) * 4.0, -2.5 + (Math.random() - 0.5), (Math.random() - 0.5) * 2.0);
        stream.scale.set(0.01 + Math.random() * 0.01, 0.8 + Math.random() * 1.0, 1);
        stream.userData.velocity.set((Math.random() - 0.5) * 0.1, 0.3 + Math.random() * 0.3, (Math.random() - 0.5) * 0.05);
        stream.rotation.y = (Math.random() - 0.5) * Math.PI;
    }

    createPointTexture() {
        const canvas = document.createElement('canvas'), size = 64; canvas.width = size; canvas.height = size;
        const context = canvas.getContext('2d'), gradient = context.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(0.2, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.6, 'rgba(255,255,255,0.5)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = gradient; context.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
    }
    
    createStreamTexture() {
        const canvas = document.createElement('canvas'), w = 2, h = 128; canvas.width = w; canvas.height = h;
        const context = canvas.getContext('2d'), gradient = context.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, 'rgba(255,255,255,0)'); gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(0.8, 'rgba(255,255,255,0.8)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = gradient; context.fillRect(0, 0, w, h);
        return new THREE.CanvasTexture(canvas);
    }
    
    update(deltaTime) {
        if (!this.isReady) return;

        if (this.isStreamType) {
            for (const stream of this.streams) {
                stream.userData.lifetime -= deltaTime;
                if (stream.userData.lifetime <= 0) this.initStreamParticle(stream);
                stream.position.addScaledVector(stream.userData.velocity, deltaTime);
                stream.position.x += Math.sin(stream.position.y * 0.5 + stream.userData.phase) * 0.008;
                stream.material.opacity = Math.sin((1.0 - (stream.userData.lifetime / stream.userData.initialLifetime)) * Math.PI) * 0.6;
            }
        } else if (this.points) {
            const material = this.points.material;
            const currentTime = material.uniforms.uTime.value += deltaTime;

            const lifetimeAttr = this.points.geometry.attributes.aLifetime;
            const positionAttr = this.points.geometry.attributes.position;
            const velocityAttr = this.points.geometry.attributes.velocity;

            let respawned = 0;
            const particlesToRespawn = 5; // Check a few particles per frame to amortize cost

            for (let i = 0; i < particlesToRespawn; i++) {
                const index = (this.respawnCursor + i) % this.particleCount;
                const maxLifetime = lifetimeAttr.getX(index);
                const spawnTime = lifetimeAttr.getY(index);

                if (currentTime - spawnTime > maxLifetime) {
                    this.initPointParticle(index, currentTime, positionAttr.array, velocityAttr.array, lifetimeAttr.array);
                    respawned++;
                }
            }

            if (respawned > 0) {
                lifetimeAttr.needsUpdate = true;
                positionAttr.needsUpdate = true;
                velocityAttr.needsUpdate = true;
            }

            this.respawnCursor = (this.respawnCursor + particlesToRespawn) % this.particleCount;
        }
    }

    dispose() {
        if (this.isStreamType) {
            if (this.streamGroup) {
                if (this.streams.length > 0) {
                    this.streams[0].geometry.dispose();
                    this.streams[0].material.map.dispose();
                }
                this.streams.forEach(stream => stream.material.dispose());
                this.scene.remove(this.streamGroup);
            }
        } else if (this.points) {
            this.scene.remove(this.points);
            this.points.geometry.dispose();
            this.points.material.uniforms.uTexture.value.dispose();
            this.points.material.dispose();
        }
    }
}