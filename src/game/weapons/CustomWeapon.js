import * as THREE from 'three';
import { Weapon } from './Weapon.js';

/**
 * A weapon instantiated from dynamic asset data created in the Asset Editor.
 */
export class CustomWeapon extends Weapon {
    constructor(assetData) {
        super(null, {
            name: assetData.assetName,
            damage: 50, // Placeholder
            cooldown: 0.5, // Placeholder
        });

        this.assetData = assetData;
        this.parts = new Map(); // Map<uuid, THREE.Object3D>
        
        this.createMesh();
        this.wielder = null; // Set when equipped
    }

    createMesh() {
        this.mesh = new THREE.Group();
        this.mesh.name = this.assetData.assetName;

        const geometryMap = {
            'Box': (s) => new THREE.BoxGeometry(...s),
            'Cylinder': (s) => new THREE.CylinderGeometry(s[0], s[1], s[2]),
            'Sphere': (s) => new THREE.SphereGeometry(s[0]),
        };

        // First pass: create all objects and map them by UUID
        for (const partData of this.assetData.geometry) {
            const geoFn = geometryMap[partData.type];
            if (!geoFn) continue;

            const material = new THREE.MeshStandardMaterial({
                color: parseInt(partData.material.color, 16) || 0xcccccc,
            });

            // Use scale from definition
            const size = partData.transform.scale || [1, 1, 1];
            const partMesh = new THREE.Mesh(geoFn(size), material);
            
            partMesh.name = partData.uuid; // For debugging
            this.parts.set(partData.uuid, partMesh);
        }

        // Second pass: build the hierarchy
        for (const partData of this.assetData.geometry) {
            const partMesh = this.parts.get(partData.uuid);
            if (!partMesh) continue;

            const { position, rotation } = partData.transform;
            if (position) partMesh.position.fromArray(position);
            if (rotation) partMesh.quaternion.setFromEuler(new THREE.Euler().fromArray(rotation));
            
            if (partData.parent) {
                const parentMesh = this.parts.get(partData.parent);
                parentMesh?.add(partMesh);
            } else {
                this.mesh.add(partMesh); // Add root parts to the main mesh group
            }
        }
    }

    attack() {
        if (!this.canAttack() || !this.wielder) return;
        
        this.triggerCooldown();
        this.wielder.world.emit('animationTriggered', {
            entity: this,
            clipName: 'fire'
        });
        
        // Placeholder attack logic
        console.log(`Custom weapon "${this.name}" fired!`);
    }

    update(deltaTime) {
        super.update(deltaTime);
        // The AnimationSystem will handle transform updates.
    }
}