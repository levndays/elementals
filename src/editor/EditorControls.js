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
        this.renderer = editor.app.renderer.renderer;
        this.input = editor.input;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this._initialDragState = null;

        this._onMouseDownHandler = this.onMouseDown.bind(this);
        this._onContextMenuHandler = (e) => e.preventDefault();
        
        this.init();
    }
    
    init() {
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.addEventListener('dragging-changed', (event) => this.onDraggingChanged(event));
        this.transformControls.addEventListener('objectChange', () => this.onObjectChange());
        this.scene.add(this.transformControls);

        this.selectionBoxGroup = new THREE.Group();
        this.selectionBoxGroup.renderOrder = 999;
        this.scene.add(this.selectionBoxGroup);
        
        this.applySnapSettings();
        
        this.renderer.domElement.addEventListener('mousedown', this._onMouseDownHandler, false);
        this.renderer.domElement.addEventListener('contextmenu', this._onContextMenuHandler, false);
    }

    dispose() {
        this.renderer.domElement.removeEventListener('mousedown', this._onMouseDownHandler, false);
        this.renderer.domElement.removeEventListener('contextmenu', this._onContextMenuHandler, false);
        this.transformControls.dispose();
        this.scene.remove(this.transformControls);
        this.scene.remove(this.selectionBoxGroup);
        this.clearSelectionBoxes();
    }

    onDraggingChanged(event) {
        this.input.enabled = !event.value;
        const selected = this.editor.selectedObjects;
        if (selected.size === 0) return;

        if (event.value) { // Drag started
            this._initialDragState = [];
            selected.forEach(entity => {
                this._initialDragState.push({
                    entity,
                    definition: JSON.parse(JSON.stringify(entity.definition))
                });
            });
            // For group scaling, we need the initial mesh scales
            if (this.transformControls.mode === 'scale' && selected.size > 1) {
                this._initialDragState.forEach(state => {
                    const mesh = state.entity.helperMesh || state.entity.mesh || state.entity.picker || state.entity;
                    state.initialScale = mesh.scale.clone();
                });
            }
        } else { // Drag ended
            this.detachFromGroup();
            
            const changes = [];
            this._initialDragState.forEach(state => {
                const { entity, definition } = state;
                const afterState = JSON.parse(JSON.stringify(entity.definition));
                const mesh = entity.helperMesh || entity.mesh || entity.picker || entity.targetHelper || entity;
                
                afterState.position = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
                if (afterState.rotation) {
                    const euler = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'YXZ');
                    afterState.rotation = { x: THREE.MathUtils.radToDeg(euler.x), y: THREE.MathUtils.radToDeg(euler.y), z: THREE.MathUtils.radToDeg(euler.z) };
                }
                
                if (this.transformControls.mode === 'scale' && afterState.size) {
                    const groupScale = this.editor.selectionGroup.scale;
                    const finalScale = selected.size > 1 ? groupScale : mesh.scale;
                    const baseSize = new THREE.Vector3().fromArray(definition.size);
                    const newSize = baseSize.clone().multiply(finalScale);
                    afterState.size = newSize.toArray();
                }

                changes.push({ entity, beforeState: definition, afterState });
            });
            
            const command = new StateChangeCommand(this.editor, changes);
            this.editor.undoManager.execute(command);
            
            this._initialDragState = null;
            this.updateSelection();
        }
    }

    onObjectChange() {
        if (this.editor.primarySelectedObject && !this.transformControls.dragging) {
            this.editor.syncObjectTransforms();
            this.editor.ui.updatePropertiesPanel();
        } else if (this.transformControls.dragging) {
            const draggedObject = this.transformControls.object;
            if (draggedObject?.userData.gameEntity?.type === 'LightTarget') {
                this.editor.syncObjectTransforms(draggedObject.userData.gameEntity.parentLight);
            } else if (draggedObject === this.editor.selectionGroup) {
                 this.editor.selectedObjects.forEach(entity => this.editor.syncObjectTransforms(entity));
            } else if (this.editor.primarySelectedObject) {
                this.editor.syncObjectTransforms(this.editor.primarySelectedObject);
            }
            this.editor.ui.updatePropertiesPanel();
        }
    }

    onMouseDown(event) {
        if (event.button !== 2 || this.transformControls.dragging || this.editor.ui.isClickOnUI(event.clientX, event.clientY)) return;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const pickableMeshes = [...this.app.entities]
            .map(e => [e.mesh, e.picker, e.targetHelper, e.helperMesh])
            .flat()
            .filter(Boolean);
            
        const intersects = this.raycaster.intersectObjects(pickableMeshes.filter(m => m.visible), true);
        const validIntersects = intersects.filter(i => i.object.userData.gameEntity?.entity);
        
        if (validIntersects.length > 0) {
            const entity = validIntersects[0].object.userData.gameEntity.entity;
            if (entity.definition?.editorSelectable === false) {
                 this.editor.deselect();
            } else {
                 if (event.shiftKey) {
                     if (this.editor.selectedObjects.has(entity)) {
                         this.editor.removeFromSelection(entity);
                     } else {
                         this.editor.addToSelection(entity);
                     }
                 } else {
                    this.editor.select(entity);
                 }
            }
        } else {
            if (!event.shiftKey) {
                this.editor.deselect();
            }
        }
    }
    
    updateSelection() {
        this.detachFromGroup();
        this.transformControls.detach();
        this.clearSelectionBoxes();
    
        const selected = this.editor.selectedObjects;
        if (selected.size === 0) return;
    
        if (selected.size === 1) {
            const entity = selected.values().next().value;
            const objectToAttach = entity.helperMesh || entity.mesh || entity.picker || entity.targetHelper || entity;
            
            this.transformControls.attach(objectToAttach);
            this.addSelectionBox(objectToAttach);
    
        } else {
            const selectionGroup = this.editor.selectionGroup;
            const centroid = new THREE.Vector3();
            selected.forEach(entity => {
                const mesh = entity.helperMesh || entity.mesh || entity.picker || entity;
                centroid.add(mesh.position);
            });
            centroid.divideScalar(selected.size);
            selectionGroup.position.copy(centroid);
            selectionGroup.rotation.set(0,0,0);
            selectionGroup.scale.set(1,1,1);
    
            selected.forEach(entity => {
                const mesh = entity.helperMesh || entity.mesh || entity.picker || entity;
                this.scene.remove(mesh);
                selectionGroup.add(mesh);
                this.addSelectionBox(mesh);
            });
    
            this.transformControls.attach(selectionGroup);
        }
        
        this.updateToolAvailability();
    }

    detachFromGroup() {
        const selectionGroup = this.editor.selectionGroup;
        const children = [...selectionGroup.children];
        for (const child of children) {
            child.updateWorldMatrix(true, false);
            selectionGroup.remove(child);
            this.scene.add(child);
        }
        selectionGroup.position.set(0,0,0);
        selectionGroup.rotation.set(0,0,0);
        selectionGroup.scale.set(1,1,1);
        selectionGroup.updateWorldMatrix(true, false);
    }
    
    updateSelectionBoxes() {
        this.selectionBoxGroup.children.forEach(box => box.update());
    }
    
    addSelectionBox(object) {
        const selectionBox = new THREE.BoxHelper(object, 0xffff00);
        selectionBox.material.depthTest = false;
        selectionBox.material.transparent = true;
        this.selectionBoxGroup.add(selectionBox);
    }
    
    clearSelectionBoxes() {
        while(this.selectionBoxGroup.children.length) {
            const box = this.selectionBoxGroup.children[0];
            this.selectionBoxGroup.remove(box);
            box.geometry.dispose();
            box.material.dispose();
        }
    }
    
    updateToolAvailability() {
        let canRotate = true, canScale = true;
        this.editor.selectedObjects.forEach(entity => {
            const entityType = entity.userData?.gameEntity?.type;
            const isEnemy = entityType === 'Enemy';
            const isLightTarget = entityType === 'LightTarget';
            const isSpecialPoint = ['SpawnPoint', 'DeathSpawnPoint', 'DirectionalLight'].includes(entityType);

            if (isSpecialPoint || isEnemy || isLightTarget) {
                canRotate = false;
                canScale = false;
            }
        });

        document.getElementById('tool-rotate').disabled = !canRotate;
        document.getElementById('tool-scale').disabled = !canScale;

        const mode = this.transformControls.getMode();
        // FIX: Changed this.controls.setTransformMode to this.setTransformMode
        if (!canRotate && mode === 'rotate') this.setTransformMode('translate');
        if (!canScale && mode === 'scale') this.setTransformMode('scale');
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