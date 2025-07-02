import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EditorControls } from './EditorControls.js';
import { EditorUI } from './EditorUI.js';
import { EditorActions } from './EditorActions.js';
import { EditorCamera } from './EditorCamera.js';
import { UndoManager, StateChangeCommand } from './UndoManager.js';

export class LevelEditor {
    constructor(app) {
        this.app = app;
        this.scene = app.scene;
        this.camera = app.camera;
        this.renderer = app.renderer.renderer;
        this.physics = app.physics;
        this.input = app.input;

        // Core State
        this.selectedObject = null;
        this.clipboard = null;
        this.isSnapEnabled = false;
        this.translationSnapValue = 1;
        this.rotationSnapValue = 15;
        this.helperVisibility = {
            Trigger: true,
            DeathTrigger: true,
            DirectionalLight: true,
            SpawnAndDeath: true,
        };

        // Internal state for rotation logic
        this._initialLightPos = null;
        this._initialPickerQuat = null;

        // Modules
        this.undoManager = new UndoManager(this);
        this.ui = new EditorUI(this);
        this.controls = new EditorControls(this);
        this.actions = new EditorActions(this);
        this.cameraController = new EditorCamera(this);
        
        this.onKeyDownHandler = this.onKeyDown.bind(this);
        document.addEventListener('keydown', this.onKeyDownHandler);
    }

    dispose() {
        document.removeEventListener('keydown', this.onKeyDownHandler);
        this.controls.dispose();
    }

    onKeyDown(event) {
        if (event.target.tagName === 'INPUT' || this.controls.transformControls.dragging) return;

        if (event.ctrlKey) {
            switch (event.code) {
                case 'KeyC': event.preventDefault(); this.actions.copySelected(); break;
                case 'KeyV': event.preventDefault(); this.actions.pasteFromClipboard(); break;
                case 'KeyZ': event.preventDefault(); this.undoManager.undo(); break;
                case 'KeyY': event.preventDefault(); this.undoManager.redo(); break;
            }
        } else {
            switch (event.code) {
                case 'KeyT': this.controls.setTransformMode('translate'); break;
                case 'KeyR': this.controls.setTransformMode('rotate'); break;
                case 'KeyS': this.controls.setTransformMode('scale'); break;
                case 'KeyQ': this.controls.toggleTransformSpace(); break;
                case 'Delete':
                case 'Backspace': this.actions.deleteSelected(); break;
            }
        }
    }

    // --- State & Selection Management ---

    select(entity) {
        if (!entity || this.selectedObject === entity) return;
        this.deselect();
        
        this.selectedObject = entity;
        const entityType = entity.userData?.gameEntity?.type;
        let objectToAttach = entity.mesh || entity.picker || entity.targetHelper || entity;

        if (entityType === 'DirectionalLight') entity.picker.material.visible = true;

        this.controls.transformControls.attach(objectToAttach);
        this.controls.selectionBox.setFromObject(objectToAttach);
        this.controls.selectionBox.visible = true;
        
        this.ui.updatePropertiesPanel();
        this.ui.updateOutliner();
        
        const isEnemy = entityType === 'Enemy';
        const isLightTarget = entityType === 'LightTarget';

        const canRotate = !(entityType === 'SpawnPoint' || entityType === 'DeathSpawnPoint' || isEnemy || isLightTarget);
        const canScale = !(entityType === 'SpawnPoint' || entityType === 'DeathSpawnPoint' || entityType === 'DirectionalLight' || isEnemy || isLightTarget);
        
        document.getElementById('tool-rotate').disabled = !canRotate;
        document.getElementById('tool-scale').disabled = !canScale;

        if (!canRotate && this.controls.transformControls.getMode() === 'rotate') this.controls.setTransformMode('translate');
        if (!canScale && this.controls.transformControls.getMode() === 'scale') this.controls.setTransformMode('translate');
    }

    deselect() {
        if (!this.selectedObject) return;
        
        if (this.selectedObject.userData?.gameEntity?.type === 'DirectionalLight') {
            this.selectedObject.picker.material.visible = false;
        }

        this.selectedObject = null;
        this.controls.transformControls.detach();
        this.controls.selectionBox.visible = false;
        this.ui.updatePropertiesPanel();
        this.ui.updateOutliner();
        
        document.getElementById('tool-rotate').disabled = false;
        document.getElementById('tool-scale').disabled = false;
    }

    selectByUUID(uuid) {
        const entityToSelect = [...this.app.entities].find(e => {
            const mesh = e.mesh || e.picker || e.targetHelper || e;
            return mesh?.uuid === uuid;
        });
        if (entityToSelect) {
            this.select(entityToSelect);
        }
    }
    
    // --- Data & Property Manipulation ---

    updateSelectedProp(prop, key, value) {
        if (!this.selectedObject) return;
        let entity = this.selectedObject;
        
        // If a light target is selected, apply the change to the parent light's definition
        if (entity.userData?.gameEntity?.type === 'LightTarget') {
            entity = entity.userData.gameEntity.parentLight;
        }

        const beforeState = entity.definition;
        const afterState = JSON.parse(JSON.stringify(beforeState)); // Create a working copy
        let target = afterState;

        const path = prop.split('.');
        for(let i = 0; i < path.length - 1; i++) {
            if(!target[path[i]]) target[path[i]] = {};
            target = target[path[i]];
        }
        const finalKey = path[path.length - 1];
        
        if (key !== null) {
            if(!target[finalKey]) target[finalKey] = {};
            target[finalKey][key] = value;
        } else {
            target[finalKey] = value.toString().startsWith('#') ? value.replace('#', '0x') : value;
        }

        const command = new StateChangeCommand(this, entity, beforeState, afterState);
        this.undoManager.execute(command);
    }
    
    applyDefinition(obj) {
        const type = obj.userData?.gameEntity?.type;
        const def = obj.definition;
        const mesh = obj.mesh;
        const body = obj.body;
    
        if (!def || !type) return;
    
        if (type === 'SpawnPoint' || type === 'DeathSpawnPoint') {
            this.syncObjectTransforms(obj); // Sync position from mesh to internal state
            this.controls.selectionBox.setFromObject(obj);
            return;
        }
    
        if (type === 'DirectionalLight') {
            const light = obj.light;
            light.color.set(parseInt(def.color, 16));
            light.intensity = def.intensity;
            light.position.set(def.position.x, def.position.y, def.position.z);
            if (def.targetPosition) {
                light.target.position.set(def.targetPosition.x, def.targetPosition.y, def.targetPosition.z);
            }
            obj.picker.position.copy(light.position);
            obj.targetHelper.position.copy(light.target.position);
            light.target.updateMatrixWorld(true);
            obj.helper.update();
            this.controls.selectionBox.setFromObject(obj.picker);
            return;
        }
    
        mesh.position.set(def.position.x, def.position.y, def.position.z);
    
        if (def.rotation && obj.isDead === undefined) {
             mesh.rotation.set(
                THREE.MathUtils.degToRad(def.rotation.x || 0),
                THREE.MathUtils.degToRad(def.rotation.y || 0),
                THREE.MathUtils.degToRad(def.rotation.z || 0)
            );
        }
    
        if (def.material?.color && mesh.material && !mesh.material.isWireframeMaterial) {
            mesh.material.color.set(parseInt(def.material.color, 16));
        }
    
        if (def.size) {
            if (type === 'Trigger' || type === 'DeathTrigger') {
                mesh.geometry.dispose();
                mesh.geometry = new THREE.BoxGeometry(...def.size);
                if (type === 'Trigger' && def.color) {
                    mesh.material.color.set(parseInt(def.color, 16));
                }
            } else if (def.type === 'Box' && body?.shapes[0]) {
                const halfExtents = new CANNON.Vec3(def.size[0] / 2, def.size[1] / 2, def.size[2] / 2);
                body.shapes[0].halfExtents.copy(halfExtents);
                body.shapes[0].updateConvexPolyhedronRepresentation();
                body.updateBoundingRadius();
                mesh.geometry.dispose();
                mesh.geometry = new THREE.BoxGeometry(...def.size);
            }
        }
    
        this.syncObjectTransforms(obj);
        this.controls.selectionBox.setFromObject(mesh);
    }
    
    syncObjectTransforms(entityToSync) {
        const entity = entityToSync || this.selectedObject;
        if (!entity) return;
        
        const entityType = entity.userData?.gameEntity?.type;
        
        if (entityType === 'SpawnPoint') {
            this.app.spawnPoint.copy(entity.position);
        } else if (entityType === 'DeathSpawnPoint') {
            this.app.deathSpawnPoint.copy(entity.position);
        } else if (entityType === 'DirectionalLight') {
            const picker = entity.picker;
            const light = entity.light;
            light.position.copy(picker.position);
            light.target.position.copy(entity.targetHelper.position);
            entity.helper.update();
            if (this.selectedObject === entity) this.controls.selectionBox.setFromObject(picker);
        } else if (entity.body) {
            entity.body.position.copy(entity.mesh.position);
            entity.body.quaternion.copy(entity.mesh.quaternion);
        }
    }
    
    onLevelLoaded() {
        this.deselect();
        this.ui.updateOutliner();
        this.ui.updatePropertiesPanel();

        // Apply initial visibility from UI checkboxes
        this.ui.setHelpersVisibility('Trigger', document.getElementById('view-toggle-msg-triggers').checked);
        this.ui.setHelpersVisibility('DeathTrigger', document.getElementById('view-toggle-death-triggers').checked);
        this.ui.setHelpersVisibility('DirectionalLight', document.getElementById('view-toggle-light-helpers').checked);
        this.ui.setHelpersVisibility('SpawnAndDeath', document.getElementById('view-toggle-spawn-helpers').checked);
    }
    
    update(deltaTime) {
        this.cameraController.update(deltaTime);
    }
}