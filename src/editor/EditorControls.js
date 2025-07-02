// src/editor/EditorControls.js

import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { StateChangeCommand } from './UndoManager.js';

/**
 * Manages object selection via raycasting, and manipulation via TransformControls (gizmos).
 * It listens for mouse events on the canvas and interacts with the selected object.
 */
export class EditorControls {
    constructor(editor) {
        this.editor = editor;
        this.app = editor.app;
        this.scene = editor.scene;
        this.camera = editor.camera;
        this.renderer = editor.app.renderer.renderer; // FIX: Get the WebGLRenderer directly from the app
        this.input = editor.input;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this._initialDragState = null; // For Undo/Redo

        this._onMouseDownHandler = this.onMouseDown.bind(this);
        this._onContextMenuHandler = (e) => e.preventDefault();
        
        this.init();
    }
    
    init() {
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.addEventListener('dragging-changed', (event) => this.onDraggingChanged(event));
        this.transformControls.addEventListener('objectChange', () => this.onObjectChange());
        this.scene.add(this.transformControls);

        this.selectionBox = new THREE.BoxHelper();
        this.selectionBox.material.depthTest = false;
        this.selectionBox.material.transparent = true;
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);
        
        this.applySnapSettings();
        
        this.renderer.domElement.addEventListener('mousedown', this._onMouseDownHandler, false);
        this.renderer.domElement.addEventListener('contextmenu', this._onContextMenuHandler, false);
    }

    dispose() {
        this.renderer.domElement.removeEventListener('mousedown', this._onMouseDownHandler, false);
        this.renderer.domElement.removeEventListener('contextmenu', this._onContextMenuHandler, false);
        this.transformControls.dispose();
        this.scene.remove(this.transformControls);
        this.scene.remove(this.selectionBox);
        this.selectionBox.geometry.dispose();
        this.selectionBox.material.dispose();
    }

    onDraggingChanged(event) {
        this.input.enabled = !event.value; // Disable camera controller while dragging
        let entity = this.editor.selectedObject;
        if (!entity) return;

        // If a target is being dragged, the command should apply to the parent light
        if (this.transformControls.object?.userData.gameEntity?.type === 'LightTarget') {
            entity = this.transformControls.object.userData.gameEntity.parentLight;
        }

        if (event.value) { // Drag started
            this._initialDragState = {
                definition: JSON.parse(JSON.stringify(entity.definition)),
            };
        } else { // Drag ended
            const beforeState = this._initialDragState.definition;
            const afterState = JSON.parse(JSON.stringify(entity.definition));
            
            this.editor.syncObjectTransforms(entity); // Ensure latest positions are synced first

            if (entity.userData.gameEntity.type === 'DirectionalLight') {
                afterState.position = { x: entity.light.position.x, y: entity.light.position.y, z: entity.light.position.z };
                afterState.targetPosition = { x: entity.light.target.position.x, y: entity.light.target.position.y, z: entity.light.target.position.z };
            } else {
                 const mesh = entity.mesh || entity.picker || entity;
                 afterState.position = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
                 const euler = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'YXZ');
                 if(afterState.rotation) {
                    afterState.rotation = { x: THREE.MathUtils.radToDeg(euler.x), y: THREE.MathUtils.radToDeg(euler.y), z: THREE.MathUtils.radToDeg(euler.z) };
                 }
                if (this.transformControls.mode === 'scale' && afterState.size) {
                     const initialSize = new THREE.Vector3().fromArray(this._initialDragState.definition.size);
                     const absScale = new THREE.Vector3().copy(mesh.scale).abs();
                     const newSize = initialSize.clone().multiply(absScale);
                     afterState.size = newSize.toArray();
                     mesh.scale.set(1, 1, 1);
                }
            }
            
            const command = new StateChangeCommand(this.editor, entity, beforeState, afterState);
            this.editor.undoManager.execute(command);
            this._initialDragState = null;
        }
    }

    onObjectChange() {
        if (this.editor.selectedObject && !this.transformControls.dragging) {
            this.editor.syncObjectTransforms();
            this.editor.ui.updatePropertiesPanel();
        } else if (this.transformControls.dragging) {
            const selectedEntity = this.editor.selectedObject;
            const draggedObject = this.transformControls.object;
            const draggedEntityType = draggedObject?.userData?.gameEntity?.type;

            if (draggedEntityType === 'LightTarget') {
                this.editor.syncObjectTransforms(draggedObject.userData.gameEntity.parentLight);
            } else if(selectedEntity) {
                this.editor.syncObjectTransforms(selectedEntity);
            }
        }
    }

    onMouseDown(event) {
        // REVISED: Select with right-click (button 2)
        if (event.button !== 2 || this.transformControls.dragging || this.editor.ui.isClickOnUI(event.clientX, event.clientY)) return;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const pickableMeshes = [...this.app.entities]
            .map(e => e.mesh || e.picker || e.targetHelper || e) // Get all possible meshes
            .flat() // Flatten in case of groups
            .filter(Boolean);
            
        const intersects = this.raycaster.intersectObjects(pickableMeshes.filter(m => m.visible), true);
        const validIntersects = intersects.filter(i => i.object.userData.gameEntity?.entity);
        
        if (validIntersects.length > 0) {
            const entity = validIntersects[0].object.userData.gameEntity.entity;
            if (entity.definition?.editorSelectable === false) {
                 this.editor.deselect();
            } else {
                 this.editor.select(entity);
            }
        } else {
            this.editor.deselect();
        }
    }

    setTransformSpace(space) {
        this.transformControls.setSpace(space);
        this.editor.ui.updateSpaceToggle(this.transformControls.space);
    }

    toggleTransformSpace() {
        const currentSpace = this.transformControls.space;
        this.setTransformSpace(currentSpace === 'world' ? 'local' : 'world');
    }

    applySnapSettings() {
        const editor = this.editor;
        if (editor.isSnapEnabled) {
            this.transformControls.setTranslationSnap(editor.translationSnapValue);
            this.transformControls.setRotationSnap(THREE.MathUtils.degToRad(editor.rotationSnapValue));
            this.transformControls.setScaleSnap(editor.translationSnapValue);
        } else {
            this.transformControls.setTranslationSnap(null);
            this.transformControls.setRotationSnap(null);
            this.transformControls.setScaleSnap(null);
        }
    }

    setTransformMode(mode) {
        if (this.transformControls.object) {
            this.transformControls.setMode(mode);
            this.editor.ui.updateTransformModeButtons(mode);
        }
    }
}