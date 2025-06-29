import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { StateChangeCommand } from './UndoManager.js';

export class EditorControls {
    constructor(editor) {
        this.editor = editor;
        this.app = editor.app;
        this.scene = editor.scene;
        this.camera = editor.camera;
        this.renderer = editor.renderer;
        this.input = editor.input;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.onMouseDownHandler = this.onMouseDown.bind(this);
        this.onContextMenuHandler = (e) => e.preventDefault();
        
        this._initialDragState = null; // For Undo/Redo

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
        
        this.renderer.domElement.addEventListener('mousedown', this.onMouseDownHandler, false);
        this.renderer.domElement.addEventListener('contextmenu', this.onContextMenuHandler, false);
    }

    dispose() {
        this.renderer.domElement.removeEventListener('mousedown', this.onMouseDownHandler, false);
        this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenuHandler, false);
        this.transformControls.dispose();
        this.scene.remove(this.transformControls);
        this.scene.remove(this.selectionBox);
        this.selectionBox.geometry.dispose();
        this.selectionBox.material.dispose();
    }

    onDraggingChanged(event) {
        this.input.enabled = !event.value;
        const entity = this.editor.selectedObject;
        if (!entity) return;

        if (event.value) { // Drag started
            this._initialDragState = {
                definition: JSON.parse(JSON.stringify(entity.definition)), // Deep copy
                position: entity.mesh.position.clone(),
                quaternion: entity.mesh.quaternion.clone(),
                scale: entity.mesh.scale.clone()
            };

            if (entity.userData.gameEntity.type === 'DirectionalLight' && this.transformControls.mode === 'rotate') {
                this.editor._initialLightPos = entity.light.position.clone();
                this.editor._initialPickerQuat = entity.picker.quaternion.clone();
            }
        } else { // Drag ended
            const beforeState = this._initialDragState.definition;
            
            // The "after" state is the object's definition after applying the gizmo changes
            const afterState = JSON.parse(JSON.stringify(entity.definition));
            afterState.position = { x: entity.mesh.position.x, y: entity.mesh.position.y, z: entity.mesh.position.z };
            const euler = new THREE.Euler().setFromQuaternion(entity.mesh.quaternion, 'YXZ');
            afterState.rotation = { x: THREE.MathUtils.radToDeg(euler.x), y: THREE.MathUtils.radToDeg(euler.y), z: THREE.MathUtils.radToDeg(euler.z) };
            
            // For scaling, calculate final size but keep position centered.
            if (this.transformControls.mode === 'scale' && afterState.size) {
                 const initialSize = new THREE.Vector3().fromArray(this._initialDragState.definition.size);
                 const newSize = initialSize.clone().multiply(entity.mesh.scale);
                 
                 afterState.size = newSize.toArray();
                 // By not changing afterState.position here, we respect the object's center
                 // position which was captured from the mesh's transform before this block.

                 // Reset the mesh scale as it's now baked into the definition
                 entity.mesh.scale.set(1, 1, 1);
            }
            
            const command = new StateChangeCommand(this.editor, entity, beforeState, afterState);
            this.editor.undoManager.execute(command);

            this._initialDragState = null;
            this.editor._initialLightPos = null;
            this.editor._initialPickerQuat = null;
        }
    }

    onObjectChange() {
        if (this.editor.selectedObject && !this.transformControls.dragging) {
            this.editor.syncObjectTransforms();
            this.editor.ui.updatePropertiesPanel();
        }
    }

    onMouseDown(event) {
        if (event.button !== 0 || this.transformControls.dragging || this.input.isClickOnUI(event.clientX, event.clientY)) return;
        
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const pickableMeshes = this.app.levelObjects.map(o => o.mesh)
            .concat(this.app.enemies.map(e => e.mesh))
            .concat(this.app.directionalLights.map(l => l.picker))
            .concat(this.app.triggers.map(t => t.mesh))
            .concat(this.app.deathTriggers.map(t => t.mesh))
            .concat(this.app.spawnPointHelper ? [this.app.spawnPointHelper] : [])
            .concat(this.app.deathSpawnPointHelper ? [this.app.deathSpawnPointHelper] : []);
            
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

    setTransformMode(mode) {
        if (this.transformControls.object) {
            this.transformControls.setMode(mode);
            this.editor.ui.updateTransformModeButtons(mode);
        }
    }
}