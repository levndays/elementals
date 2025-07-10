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

    _loadDataWithUndo(newData) {
        const oldState = this.app.assetContext.serialize();
        const command = {
            execute: () => {
                this.app.assetContext.loadFromData(newData);
                this.app.ui.updateOutliner();
                this.app.ui.updateAnimationClips();
                this.app.deselect();
            },
            undo: () => {
                this.app.assetContext.loadFromData(oldState);
                this.app.ui.updateOutliner();
                this.app.ui.updateAnimationClips();
                this.app.deselect();
            }
        };
        this.app.undoManager.execute(command);
    }

    loadFile(data) {
        this._loadDataWithUndo(data);
    }

    async loadExampleDagger() {
        try {
            const response = await fetch('./assets/weapons/weapon-sai.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            this._loadDataWithUndo(data);
        } catch (error) {
            console.error("Failed to load example dagger:", error);
            alert("Could not load example asset. See console for details.");
        }
    }

    async loadExamplePistol() {
        try {
            const response = await fetch('./assets/weapons/weapon-revolver.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            this._loadDataWithUndo(data);
        } catch (error) {
            console.error("Failed to load example pistol:", error);
            alert("Could not load example asset. See console for details.");
        }
    }
    
    updateKeyframeProperty(keyframeInfo, property, newValue) {
        const { clipName, trackIndex, keyIndex } = keyframeInfo;
        const keyframe = this.app.assetContext.animations[clipName].tracks[trackIndex].keyframes[keyIndex];

        const beforeState = JSON.parse(JSON.stringify(keyframe));
        const afterState = JSON.parse(JSON.stringify(keyframe));
        
        if(property === 'time') {
            afterState.time = newValue;
        } else if (Array.isArray(keyframe.value)) {
            const axisMap = { x: 0, y: 1, z: 2 };
            afterState.value[axisMap[property]] = newValue;
        }

        const command = {
            execute: () => {
                Object.assign(keyframe, afterState);
                // Re-sort keyframes if time was changed
                if(property === 'time') {
                    this.app.assetContext.animations[clipName].tracks[trackIndex].keyframes.sort((a,b) => a.time - b.time);
                    // We need to find the new index of our modified keyframe
                    this.app.ui.selectedKeyframeInfo.keyIndex = this.app.assetContext.animations[clipName].tracks[trackIndex].keyframes.findIndex(k => k === keyframe);
                }
                this.app.ui.updateTimelineView();
            },
            undo: () => {
                Object.assign(keyframe, beforeState);
                 if(property === 'time') {
                    this.app.assetContext.animations[clipName].tracks[trackIndex].keyframes.sort((a,b) => a.time - b.time);
                     this.app.ui.selectedKeyframeInfo.keyIndex = this.app.assetContext.animations[clipName].tracks[trackIndex].keyframes.findIndex(k => k === keyframe);
                }
                this.app.ui.updateTimelineView();
            }
        };
        this.app.undoManager.execute(command);
    }

    deleteSelectedKeyframe() {
        if (!this.app.ui.selectedKeyframeInfo) return;

        const { clipName, trackIndex, keyIndex } = this.app.ui.selectedKeyframeInfo;
        const track = this.app.assetContext.animations[clipName].tracks[trackIndex];
        const keyframeToRemove = track.keyframes[keyIndex];
        
        const command = {
            execute: () => {
                track.keyframes.splice(keyIndex, 1);
                this.app.ui.deselectKeyframe();
                this.app.ui.updateTimelineView();
            },
            undo: () => {
                track.keyframes.splice(keyIndex, 0, keyframeToRemove);
                this.app.ui.selectKeyframe(clipName, trackIndex, keyIndex);
                this.app.ui.updateTimelineView();
            }
        };
        this.app.undoManager.execute(command);
    }

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