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
        const getTransform = (obj) => ({
            position: obj.position.toArray(),
            rotation: obj.rotation.toArray(),
            scale: obj.scale.toArray()
        });

        const geometry = [];
        this.parts.forEach(part => {
            geometry.push({
                uuid: part.uuid,
                name: part.name,
                type: part.geometry.type.replace('Geometry', ''),
                parent: part.parent !== this.assetRoot ? part.parent.uuid : null,
                transform: getTransform(part),
                material: { color: '#' + part.material.color.getHexString() }
            });
        });
        
        return {
            assetName: "CustomAsset",
            type: "weapon",
            geometry,
            animations: {}
        };
    }

    clear() {
        [...this.assetRoot.children].forEach(child => this.removePart(child));
        this.parts.clear();
        this.animations = {};
        this.selectedPart = null;
    }
}