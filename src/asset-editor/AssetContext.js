import * as THREE from 'three';

/**
 * The "document" or data model for the asset being edited.
 * It holds the definitive state of all parts and their hierarchy.
 */
export class AssetContext {
    constructor(scene) {
        this.scene = scene;
        this.assetRoot = new THREE.Group();
        this.assetRoot.name = "AssetRoot";
        this.scene.add(this.assetRoot);

        /** @type {Map<string, THREE.Object3D>} */
        this.parts = new Map();
        this.animations = {};
        this.selectedPart = null;
    }

    addPart(partMesh, parent) {
        this.parts.set(partMesh.uuid, partMesh);
        const targetParent = parent || this.assetRoot;
        targetParent.add(partMesh);
        return partMesh;
    }

    removePart(partMesh) {
        if (!partMesh) return;
        partMesh.removeFromParent();
        this.parts.delete(partMesh.uuid);
        // Recursively remove children from the map
        [...partMesh.children].forEach(child => this.removePart(child));
    }

    reparentPart(part, newParent) {
        if (!part || !newParent) return;
        newParent.attach(part); // .attach() preserves world transform
    }
    
    setSelectedPart(part) {
        this.selectedPart = part;
    }

    serialize() {
        const geometry = [];
        this.parts.forEach(part => {
            const transform = {
                position: part.position.toArray(),
                quaternion: part.quaternion.toArray(),
                scale: part.scale.toArray(),
            };

            const partData = {
                uuid: part.uuid,
                name: part.name,
                type: part.geometry.type.replace('Geometry', ''),
                parent: part.parent !== this.assetRoot ? part.parent.uuid : null,
                transform: transform,
                material: {
                    color: '#' + part.material.color.getHexString(),
                    metalness: part.material.metalness,
                    roughness: part.material.roughness,
                }
            };
            geometry.push(partData);
        });
        
        return {
            assetName: this.assetRoot.name,
            type: "weapon",
            geometry,
            animations: this.animations
        };
    }

    loadFromData(assetData) {
        this.clear();
        if (!assetData) return;

        this.assetRoot.name = assetData.assetName || "CustomAsset";
        
        const createdParts = new Map(); // Maps original UUID to new THREE.Mesh
        const geometryMap = {
            'Box': (s) => new THREE.BoxGeometry(...s),
            'Cylinder': (s) => new THREE.CylinderGeometry(s[0], s[1], s[2]),
            'Sphere': (s) => new THREE.SphereGeometry(s[0]),
        };

        if (assetData.geometry) {
            // First pass: create all meshes
            assetData.geometry.forEach(partData => {
                const geoFn = geometryMap[partData.type];
                if (!geoFn) return;

                const material = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(partData.material.color),
                    metalness: partData.material.metalness ?? 0.5,
                    roughness: partData.material.roughness ?? 0.5,
                });

                const scale = partData.transform.scale || [1, 1, 1];
                const partMesh = new THREE.Mesh(geoFn(scale), material);
                partMesh.name = partData.name;
                
                createdParts.set(partData.uuid, partMesh);
            });
            
            // Second pass: set transforms and build hierarchy
            assetData.geometry.forEach(partData => {
                const partMesh = createdParts.get(partData.uuid);
                if (!partMesh) return;

                const { position, quaternion, rotation } = partData.transform;
                if (position) partMesh.position.fromArray(position);
                
                // Handle both quaternion and legacy euler rotation data
                if (quaternion) {
                    partMesh.quaternion.fromArray(quaternion);
                } else if (rotation) {
                    partMesh.rotation.fromArray(rotation);
                }

                const parentMesh = partData.parent ? createdParts.get(partData.parent) : null;
                this.addPart(partMesh, parentMesh);
            });
        }
        
        this.animations = assetData.animations || {};
    }

    clear() {
        [...this.assetRoot.children].forEach(child => this.removePart(child));
        this.parts.clear();
        this.animations = {};
        this.selectedPart = null;
    }
}