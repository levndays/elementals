import * as THREE from 'three';

export class BulletTracer {
    constructor({ scene, weapon, hitPoint }) {
        this.scene = scene;
        this.lifetime = 0.2; // Very short-lived
        this.elapsedTime = 0;

        const startPoint = new THREE.Vector3(0, 0, -0.27);
        weapon.mesh.localToWorld(startPoint);
        
        const distance = startPoint.distanceTo(hitPoint);
        const direction = new THREE.Vector3().subVectors(hitPoint, startPoint).normalize();
        
        const material = new THREE.MeshBasicMaterial({ color: 0xffffaf, transparent: true, opacity: 0.8 });
        const geometry = new THREE.CylinderGeometry(0.01, 0.01, distance, 4);
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(startPoint).add(direction.clone().multiplyScalar(distance / 2));
        
        const orientation = new THREE.Matrix4();
        const offsetRotation = new THREE.Matrix4();
        orientation.lookAt(startPoint, hitPoint, new THREE.Object3D().up);
        offsetRotation.makeRotationX(Math.PI / 2);
        orientation.multiply(offsetRotation);
        this.mesh.quaternion.setFromRotationMatrix(orientation);

        this.scene.add(this.mesh);
    }

    update(deltaTime) {
        this.elapsedTime += deltaTime;
        if (this.elapsedTime >= this.lifetime) {
            this.cleanup();
            return false; // Signal to VFXManager to remove
        }
        this.mesh.material.opacity = 1.0 - (this.elapsedTime / this.lifetime);
        return true;
    }

    cleanup() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}