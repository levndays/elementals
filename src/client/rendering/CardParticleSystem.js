import * as THREE from 'three';

export class CardParticleSystem {
    constructor(scene, element) {
        this.scene = scene;
        this.element = element;
        this.isStreamType = ['Air', 'Water'].includes(this.element);

        if (this.isStreamType) {
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
        } else {
            this.particleCount = 50;
            this.velocities = [];
            this.lifetimes = [];
            const elementColors = { Fire: '#FF771A', Earth: '#B39159', Utility: '#A16BFF', Default: '#FFFFFF' };
            this.color = elementColors[element] || elementColors.Default;
            const positions = new Float32Array(this.particleCount * 3);
            const opacities = new Float32Array(this.particleCount);
            for (let i = 0; i < this.particleCount; i++) this.initPointParticle(i, positions, opacities);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('alpha', new THREE.BufferAttribute(opacities, 1));
            const material = new THREE.PointsMaterial({ color: this.color, size: 0.08, map: this.createPointTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
            this.points = new THREE.Points(geometry, material);
            this.scene.add(this.points);
        }
    }

    initPointParticle(i, positions, opacities) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * 2;
        positions[i3 + 1] = (Math.random() - 0.5) * 1.5 - 1.0;
        positions[i3 + 2] = (Math.random() - 0.5) * 0.5;
        this.velocities[i] = new THREE.Vector3((Math.random() - 0.5) * 0.1, Math.random() * 0.4 + 0.2, (Math.random() - 0.5) * 0.1);
        this.lifetimes[i] = Math.random() * 3.0 + 1.0;
        opacities[i] = 1.0;
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
        if (this.isStreamType) {
            for (const stream of this.streams) {
                stream.userData.lifetime -= deltaTime;
                if (stream.userData.lifetime <= 0) this.initStreamParticle(stream);
                stream.position.addScaledVector(stream.userData.velocity, deltaTime);
                stream.position.x += Math.sin(stream.position.y * 0.5 + stream.userData.phase) * 0.008;
                stream.material.opacity = Math.sin((1.0 - (stream.userData.lifetime / stream.userData.initialLifetime)) * Math.PI) * 0.6;
            }
        } else {
            const positions = this.points.geometry.attributes.position.array;
            const opacities = this.points.geometry.attributes.alpha.array;
            for (let i = 0; i < this.particleCount; i++) {
                if ((this.lifetimes[i] -= deltaTime) <= 0) this.initPointParticle(i, positions, opacities);
                const i3 = i * 3;
                positions[i3] += this.velocities[i].x * deltaTime;
                positions[i3 + 1] += this.velocities[i].y * deltaTime;
                positions[i3 + 2] += this.velocities[i].z * deltaTime;
                opacities[i] = Math.max(0, this.lifetimes[i] / 3.0);
            }
            this.points.geometry.attributes.position.needsUpdate = true;
            this.points.geometry.attributes.alpha.needsUpdate = true;
        }
    }

    dispose() {
        if (this.isStreamType) {
            if (this.streams.length > 0) {
                this.streams[0].geometry.dispose();
                this.streams[0].material.map.dispose();
            }
            this.streams.forEach(stream => stream.material.dispose());
            this.scene.remove(this.streamGroup);
        } else if (this.points) {
            this.scene.remove(this.points);
            this.points.geometry.dispose();
            this.points.material.map.dispose();
            this.points.material.dispose();
        }
    }
}