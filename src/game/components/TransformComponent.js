import * as THREE from 'three';

/**
 * Data component storing position, rotation, and scale for an entity.
 * Useful for entities that have a visual representation but no physics body.
 */
export class TransformComponent {
    constructor() {
        this.position = new THREE.Vector3();
        this.quaternion = new THREE.Quaternion();
        this.scale = new THREE.Vector3(1, 1, 1);
    }
}