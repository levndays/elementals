import * as THREE from 'three';

/**
 * Manages the visual representation of a FireflyProjectile.
 */
export class FireflyProjectileVisual {
    constructor(entity, scene) {
        this.entity = entity;
        this.scene = scene;

        const geometry = new THREE.SphereGeometry(0.15, 8, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffa500,
            emissive: 0xffa500,
            emissiveIntensity: 5,
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = false;
        
        this.light = new THREE.PointLight(0xffa500, 150, 10, 2);
        this.mesh.add(this.light);
        
        this.entity.mesh = this.mesh;
        this.mesh.userData.entity = this.entity;

        this.scene.add(this.mesh);
    }

    update(deltaTime) {
        if (!this.entity || this.entity.isDead || !this.entity.physics?.body) {
            return;
        }
        // Sync position and rotation from physics body
        this.mesh.position.copy(this.entity.physics.body.position);
        this.mesh.quaternion.copy(this.entity.physics.body.quaternion);
    }

    dispose() {
        if (!this.scene) return;
        if (this.entity) {
            this.entity.mesh = null;
        }
        this.scene.remove(this.mesh);
        this.mesh.geometry?.dispose();
        this.mesh.material?.dispose();
        this.light?.dispose();
        this.scene = null;
        this.entity = null;
    }
}