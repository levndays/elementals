// src/client/rendering/WaveVFX.js
import * as THREE from 'three';
import { GAME_CONFIG } from '../../shared/config.js';

// Asynchronously load shaders once
const vertexShaderPromise = fetch('./src/client/rendering/shaders/wave.vert').then(res => res.text());
const fragmentShaderPromise = fetch('./src/client/rendering/shaders/wave.frag').then(res => res.text());

export class WaveVFX {
    constructor(scene, position, direction) {
        this.scene = scene;
        this.lifetime = 1.0;
        this.elapsedTime = 0;
        this.isReady = false;

        this.init(position, direction);
    }

    async init(position, direction) {
        const config = GAME_CONFIG.WAVE_POWER;
        
        // Geometry is in XY plane by default. Animation (using vUv.y) runs along its height (local Y).
        const geometry = new THREE.PlaneGeometry(config.WIDTH, config.LENGTH, 20, 20);
        // Rotate the geometry itself so it lies flat on the XZ plane.
        // The original local Y-axis now points along the world +Z axis.
        geometry.rotateX(-Math.PI / 2);

        const vertexShader = await vertexShaderPromise;
        const fragmentShader = await fragmentShaderPromise;

        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uProgress: { value: 0 },
                uColor: { value: new THREE.Color(0x00A3FF) },
                uLength: { value: config.LENGTH }
            },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        
        // Position the mesh's center so its back edge starts at the player.
        this.mesh.position.copy(position).add(direction.clone().multiplyScalar(config.LENGTH / 2));

        // The animation is reversed in the shader to move along local -Z.
        // We align the mesh's local -Z axis with the world 'direction' vector.
        const animationDirectionLocal = new THREE.Vector3(0, 0, -1);
        this.mesh.quaternion.setFromUnitVectors(animationDirectionLocal, direction.clone().setY(0).normalize());
        
        this.scene.add(this.mesh);
        this.isReady = true;
    }

    update(deltaTime) {
        if (!this.isReady) return true;

        this.elapsedTime += deltaTime;
        if (this.elapsedTime >= this.lifetime) {
            this.cleanup();
            return false;
        }
        
        const progress = this.elapsedTime / this.lifetime;
        this.mesh.material.uniforms.uTime.value = this.elapsedTime;
        this.mesh.material.uniforms.uProgress.value = progress;

        return true;
    }

    cleanup() {
        if (!this.mesh) return;
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.mesh = null;
    }
}