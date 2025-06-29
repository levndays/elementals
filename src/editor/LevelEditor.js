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
        this.helperVisibility = {
            msgTriggers: true,
            deathTriggers: true,
            lightHelpers: true,
            spawnHelpers: true,
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
        let objectToAttach = entity.mesh || entity.picker || entity;

        if (entityType === 'DirectionalLight') entity.picker.material.visible = true;

        this.controls.transformControls.attach(objectToAttach);
        this.controls.selectionBox.setFromObject(objectToAttach);
        this.controls.selectionBox.visible = true;
        
        this.ui.propertiesAccordion.style.display = 'block';
        this.ui.propertiesAccordion.open = true;
        
        this.ui.updatePropertiesPanel();
        this.ui.updateOutliner();
        
        const isEnemy = entity.isDead !== undefined;
        const isTrigger = entityType === 'Trigger' || entityType === 'DeathTrigger';
        const canRotate = !(entityType === 'SpawnPoint' || entityType === 'DeathSpawnPoint' || isTrigger);
        const canScale = !(entityType === 'SpawnPoint' || entityType === 'DeathSpawnPoint' || entityType === 'DirectionalLight' || isEnemy || isTrigger);
        
        document.getElementById('editor-mode-rotate').disabled = !canRotate;
        document.getElementById('editor-mode-scale').disabled = !canScale;

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
        this.ui.propertiesAccordion.style.display = 'none';
        this.ui.updateOutliner();
        
        document.getElementById('editor-mode-rotate').disabled = false;
        document.getElementById('editor-mode-scale').disabled = false;
    }

    selectByUUID(uuid) {
        const allEntities = [
            ...this.app.levelObjects, ...this.app.enemies, ...this.app.directionalLights,
            ...this.app.triggers, ...this.app.deathTriggers,
            this.app.spawnPointHelper, this.app.deathSpawnPointHelper,
        ].filter(Boolean);

        const entityToSelect = allEntities.find(e => (e.mesh || e.picker || e).uuid === uuid);
        if (entityToSelect) this.select(entityToSelect);
    }
    
    // --- Data & Property Manipulation ---

    updateSelectedProp(prop, key, value) {
        if (!this.selectedObject) return;
        const entity = this.selectedObject;
        const entityType = entity.userData?.gameEntity?.type;
        
        const beforeState = entity.definition;
        const afterState = JSON.parse(JSON.stringify(beforeState)); // Create a working copy
        let target = afterState;

        // Navigate to the correct property in the copied state
        const path = prop.split('.');
        for(let i = 0; i < path.length - 1; i++) {
            if(!target[path[i]]) target[path[i]] = {};
            target = target[path[i]];
        }
        const finalKey = path[path.length - 1];
        
        // Update the value in the copied state
        if (key !== null) { // For vectors
            if(!target[finalKey]) target[finalKey] = {};
            target[finalKey][key] = value;
        } else { // For direct properties
            target[finalKey] = value.toString().startsWith('#') ? value.replace('#', '0x') : value;
        }

        const command = new StateChangeCommand(this, entity, beforeState, afterState);
        this.undoManager.execute(command);
    }
    
    applyDefinition(obj) {
        const type = obj.userData?.gameEntity?.type;
        if (type === 'SpawnPoint' || type === 'DeathSpawnPoint') {
            this.controls.selectionBox.setFromObject(obj);
            return;
        }

        const def = obj.definition;
        const mesh = obj.mesh;
        const body = obj.body;
        
        // Position
        mesh.position.set(def.position.x, def.position.y, def.position.z);
        
        // Rotation
        if (def.rotation && obj.isDead === undefined) {
             mesh.rotation.set(
                THREE.MathUtils.degToRad(def.rotation.x || 0),
                THREE.MathUtils.degToRad(def.rotation.y || 0),
                THREE.MathUtils.degToRad(def.rotation.z || 0)
            );
        }

        // Material Color
        if (type !== 'Trigger' && def.material && def.material.color && mesh.material) {
            mesh.material.color.set(parseInt(def.material.color, 16));
        }

        // Size & Geometry
        if((type === 'Trigger' || type === 'DeathTrigger') && def.size) {
            mesh.geometry.dispose();
            mesh.geometry = new THREE.BoxGeometry(...def.size);
            if(type === 'Trigger' && def.color) { // Handle trigger color
                mesh.material.color.set(parseInt(def.color, 16));
            }
        } else if(def.size && def.type === 'Box' && body?.shapes[0]) {
            const halfExtents = new CANNON.Vec3(def.size[0]/2, def.size[1]/2, def.size[2]/2);
            body.shapes[0].halfExtents.copy(halfExtents);
            body.shapes[0].updateConvexPolyhedronRepresentation();
            body.updateBoundingRadius();
            mesh.geometry.dispose();
            mesh.geometry = new THREE.BoxGeometry(...def.size);
        }
        
        this.syncObjectTransforms();
        this.controls.selectionBox.setFromObject(mesh);
    }
    
    syncObjectTransforms() {
        if (!this.selectedObject) return;
        
        const entity = this.selectedObject;
        const entityType = entity.userData?.gameEntity?.type;
        
        if (entityType === 'Trigger' || entityType === 'DeathTrigger') {
            entity.definition.position = { x: entity.mesh.position.x, y: entity.mesh.position.y, z: entity.mesh.position.z };
        } else if (entityType === 'SpawnPoint') {
            this.app.spawnPoint.x = entity.position.x;
            this.app.spawnPoint.y = entity.position.y;
            this.app.spawnPoint.z = entity.position.z;
        } else if (entityType === 'DeathSpawnPoint') {
            this.app.deathSpawnPoint.x = entity.position.x;
            this.app.deathSpawnPoint.y = entity.position.y;
            this.app.deathSpawnPoint.z = entity.position.z;
        } else if (entityType === 'DirectionalLight') {
            const picker = entity.picker;
            const light = entity.light;

            if (this.controls.transformControls.mode === 'rotate' && this.controls.transformControls.dragging && this._initialLightPos) {
                const deltaQuat = picker.quaternion.clone().multiply(this._initialPickerQuat.clone().invert());
                light.position.copy(this._initialLightPos).applyQuaternion(deltaQuat);
                picker.position.copy(light.position);
            } else {
                light.position.copy(picker.position);
            }
            
            light.target.position.set(0,0,0);
            entity.definition.position = { x: light.position.x, y: light.position.y, z: light.position.z };
            entity.helper.update();

            if (this.selectedObject === entity) this.controls.selectionBox.setFromObject(picker);
        } else {
            if (entity.body) {
                entity.body.position.copy(entity.mesh.position);
                entity.body.quaternion.copy(entity.mesh.quaternion);
            }
        }
    }
    
    setLevelData() {
        this.deselect();
        this.ui.updateOutliner();
        this.ui.setInitialSceneSettings(this.app.settings);

        // Apply initial visibility from UI checkboxes
        this.ui.setHelpersVisibility('msgTriggers', document.getElementById('view-toggle-msg-triggers').checked);
        this.ui.setHelpersVisibility('deathTriggers', document.getElementById('view-toggle-death-triggers').checked);
        this.ui.setHelpersVisibility('lightHelpers', document.getElementById('view-toggle-light-helpers').checked);
        this.ui.setHelpersVisibility('spawnHelpers', document.getElementById('view-toggle-spawn-helpers').checked);
    }
    
    update(deltaTime) {
        this.cameraController.update(deltaTime);
    }
}