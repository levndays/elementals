// src/client/rendering/EnemyProjectileVisual.js

import * as THREE from 'three';

/**
 * Manages the visual representation of an EnemyProjectile.
 * It creates the mesh and syncs its position with the logical entity's physics body.
 */
export class EnemyProjectileVisual {
    constructor(entity, scene) {
        this.entity = entity;
        this.scene = scene;

        const geometry = new THREE.SphereGeometry(0.2, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 10 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;

        this.light = new THREE.PointLight(0x00ffff, 200, 20, 2);
        this.mesh.add(this.light);
        
        // Link mesh to entity for sync systems
        this.entity.mesh = this.mesh;
        this.mesh.userData.entity = this.entity;

        this.scene.add(this.mesh);
    }

    /**
     * Updates the visual's position to match its physics body.
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    update(deltaTime) {
        if (!this.entity || this.entity.isDead || !this.entity.physics?.body) {
            // The logical entity might be removed before the visual.
            // The VFX system will call dispose() shortly.
            return;
        }
        this.mesh.position.copy(this.entity.physics.body.position);
    }

    /**
     * Cleans up Three.js resources when the visual is no longer needed.
     */
    dispose() {
        if (!this.scene) return; // Already disposed

        if (this.entity) {
            this.entity.mesh = null; // Unlink
        }

        this.scene.remove(this.mesh);
        this.mesh.geometry?.dispose();
        this.mesh.material?.dispose();
        this.light?.dispose();
        this.scene = null;
        this.entity = null;
    }
}