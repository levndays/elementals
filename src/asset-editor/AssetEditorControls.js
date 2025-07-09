import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { StateChangeCommand } from './UndoManager.js';

export class AssetEditorControls {
    constructor(app) {
        this.app = app;
        this.camera = app.camera;
        this.renderer = app.renderer.renderer;
        this.input = app.input;
        this.scene = app.scene;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // --- Snapping State ---
        this.isSnapEnabled = false;
        this.translationSnapValue = 0.5;
        this.rotationSnapValue = 15;

        this._initialDragState = null;
        this._onMouseDownHandler = this.onMouseDown.bind(this);
        this.init();
    }

    init() {
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.scene.add(this.transformControls);
        this.transformControls.addEventListener('dragging-changed', (event) => this.onDraggingChanged(event));
        this.renderer.domElement.addEventListener('mousedown', this._onMouseDownHandler, false);
        this.applySnapSettings();
    }
    
    setSnapEnabled(enabled) {
        this.isSnapEnabled = enabled;
        this.applySnapSettings();
    }

    setTranslationSnap(value) {
        this.translationSnapValue = value;
        this.applySnapSettings();
    }

    setRotationSnap(value) {
        this.rotationSnapValue = value;
        this.applySnapSettings();
    }

    applySnapSettings() {
        if (this.isSnapEnabled) {
            this.transformControls.setTranslationSnap(this.translationSnapValue);
            this.transformControls.setRotationSnap(THREE.MathUtils.degToRad(this.rotationSnapValue));
            // A reasonable default for scale snapping, can be customized later if needed
            this.transformControls.setScaleSnap(this.translationSnapValue / 10);
        } else {
            this.transformControls.setTranslationSnap(null);
            this.transformControls.setRotationSnap(null);
            this.transformControls.setScaleSnap(null);
        }
    }

    onMouseDown(event) {
        if (event.button !== 0 || this.transformControls.dragging) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.app.assetContext.assetRoot.children, true);
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
             if (event.shiftKey) {
                if (this.app.selectedObjects.has(object)) {
                    this.app.removeFromSelection(object);
                } else {
                    this.app.addToSelection(object);
                }
            } else {
                if (!this.app.selectedObjects.has(object)) {
                    this.app.select(object);
                }
            }
        } else {
            if (!event.shiftKey) {
                this.app.deselect();
            }
        }
    }
    
    onDraggingChanged(event) {
        this.input.enabled = !event.value;
        const selected = this.app.selectedObjects;
        if (selected.size === 0) return;

        if (event.value) { // Drag started
            this._initialDragState = [];
            selected.forEach(obj => {
                this._initialDragState.push({
                    object: obj,
                    position: obj.position.clone(),
                    quaternion: obj.quaternion.clone(),
                    scale: obj.scale.clone()
                });
            });
            if (this.app.selectionGroup.children.length > 0) {
                 this._initialDragState.push({
                    object: this.app.selectionGroup,
                    position: this.app.selectionGroup.position.clone(),
                    quaternion: this.app.selectionGroup.quaternion.clone(),
                    scale: this.app.selectionGroup.scale.clone()
                });
            }
        } else { // Drag ended
            const changes = [];
            this.detachFromGroup(); // Detach first to get final world transforms

            this._initialDragState.forEach(state => {
                const { object, ...beforeState } = state;
                const afterState = {
                    position: object.position.clone(),
                    quaternion: object.quaternion.clone(),
                    scale: object.scale.clone()
                };
                
                if (!beforeState.position.equals(afterState.position) ||
                    !beforeState.quaternion.equals(afterState.quaternion) ||
                    !beforeState.scale.equals(afterState.scale)) {
                     changes.push({ entity: object, beforeState, afterState });
                }
            });

            if (changes.length > 0) {
                this.app.undoManager.execute(new StateChangeCommand(this.app, changes));
            }
            this._initialDragState = null;
            this.updateSelection(); // Re-sync selection boxes and gizmo
        }
    }

    updateSelection() {
        this.detachFromGroup();
        this.transformControls.detach();

        const selected = this.app.selectedObjects;
        if (selected.size === 0) return;

        if (selected.size === 1) {
            const object = selected.values().next().value;
            this.transformControls.attach(object);
        } else {
            const group = this.app.selectionGroup;
            const centroid = new THREE.Vector3();
            selected.forEach(obj => centroid.add(obj.position));
            centroid.divideScalar(selected.size);
            group.position.copy(centroid);
            group.rotation.set(0,0,0);
            group.scale.set(1,1,1);
            
            selected.forEach(obj => group.attach(obj)); // .attach() preserves world transform
            this.transformControls.attach(group);
        }
    }

    detachFromGroup() {
        const group = this.app.selectionGroup;
        const root = this.app.assetContext.assetRoot;
        while(group.children.length) {
            root.attach(group.children[0]); // .attach() preserves world transform
        }
    }

    select(object) { this.updateSelection(); }
    deselect() { this.updateSelection(); }
    setMode(mode) { this.transformControls.setMode(mode); this.app.ui.updateTransformModeButtons(mode); }
    update() { /* Not needed for controls */ }
    dispose() { this.renderer.domElement.removeEventListener('mousedown', this._onMouseDownHandler); this.transformControls.dispose(); }
}