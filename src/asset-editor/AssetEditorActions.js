import * as THREE from 'three';
import { StateChangeCommand } from './UndoManager.js';

export class AssetEditorActions {
    constructor(app) {
        this.app = app;
    }

    _createPart(geometry, name) {
        const material = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.5,
            roughness: 0.5
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = name;
        return mesh;
    }

    _addPart(geometry, name) {
        const newPart = this._createPart(geometry, name);
        
        const command = {
            execute: () => {
                this.app.assetContext.addPart(newPart, this.app.primarySelectedObject);
                this.app.select(newPart);
            },
            undo: () => {
                this.app.deselect();
                this.app.assetContext.removePart(newPart);
            }
        };
        this.app.undoManager.execute(command);
    }
    
    addBox() { this._addPart(new THREE.BoxGeometry(1, 1, 1), 'Box'); }
    addCylinder() { this._addPart(new THREE.CylinderGeometry(0.5, 0.5, 1, 16), 'Cylinder'); }
    addSphere() { this._addPart(new THREE.SphereGeometry(0.5, 16, 16), 'Sphere'); }

    deleteSelected() {
        if (this.app.selectedObjects.size === 0) return;
        
        const partsToDelete = [...this.app.selectedObjects];
        const command = {
            execute: () => {
                this.app.deselect();
                partsToDelete.forEach(part => this.app.assetContext.removePart(part));
            },
            undo: () => {
                this.app.deselect();
                partsToDelete.forEach(part => {
                    this.app.assetContext.addPart(part, part.parent);
                    this.app.addToSelection(part);
                });
            }
        };
        this.app.undoManager.execute(command);
    }

    reparentPart(partUuid, newParentUuid) {
        const part = this.app.assetContext.parts.get(partUuid);
        const oldParent = part.parent;
        const newParent = newParentUuid ? this.app.assetContext.parts.get(newParentUuid) : this.app.assetContext.assetRoot;

        if (!part || !newParent || part === newParent || part.children.includes(newParent)) return;

        const command = {
            execute: () => {
                this.app.assetContext.reparentPart(part, newParent);
                this.app.ui.updateOutliner();
            },
            undo: () => {
                this.app.assetContext.reparentPart(part, oldParent);
                this.app.ui.updateOutliner();
            }
        };
        this.app.undoManager.execute(command);
    }
}