// src/editor/LevelEditor.js
  import * as THREE from 'three';
    import * as CANNON from 'cannon-es';
    import { EditorControls } from './EditorControls.js';
    import { EditorUI } from './EditorUI.js';
    import { EditorActions } from './EditorActions.js';
    import { EditorCamera } from './EditorCamera.js';
    import { UndoManager, StateChangeCommand } from './UndoManager.js';
    import { COLLISION_GROUPS } from '../shared/CollisionGroups.js';
    
    export class LevelEditor {
        constructor(app) {
            this.app = app;
            this.scene = app.scene;
            this.camera = app.camera;
            this.renderer = app.renderer.renderer;
            this.physics = app.physics;
            this.input = app.input;
    
            // Core State
            this.selectedObjects = new Set();
            this.primarySelectedObject = null; // The one whose properties are shown in inspector
            this.clipboard = null;
            this.isSnapEnabled = false;
            this.translationSnapValue = 1;
            this.rotationSnapValue = 15;
            this.helperVisibility = {
                Trigger: true,
                DeathTrigger: true,
                DirectionalLight: true,
                SpawnAndDeath: true,
                Water: true,
            };
            
            // Group for multi-object transforms
            this.selectionGroup = new THREE.Group();
            this.scene.add(this.selectionGroup);
    
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
                    case 'KeyC': event.preventDefault(); if (this.selectedObjects.size > 0) this.actions.copySelected(); break;
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
                    case 'Backspace': if (this.selectedObjects.size > 0) this.actions.deleteSelected(); break;
                }
            }
        }
    
        // --- State & Selection Management ---
    
        select(entity) {
            this.deselect();
            this.addToSelection(entity);
        }
    
        addToSelection(entity) {
            if (!entity || this.selectedObjects.has(entity)) return;
    
            this.selectedObjects.add(entity);
            this.primarySelectedObject = entity;
            this.controls.updateSelection();
            this.ui.updatePropertiesPanel();
            this.ui.updateOutliner();
        }
        
        removeFromSelection(entity) {
            if (!entity || !this.selectedObjects.has(entity)) return;
            this.selectedObjects.delete(entity);
            if (this.primarySelectedObject === entity) {
                this.primarySelectedObject = this.selectedObjects.size > 0 ? this.selectedObjects.values().next().value : null;
            }
            this.controls.updateSelection();
            this.ui.updatePropertiesPanel();
            this.ui.updateOutliner();
        }
    
        deselect() {
            if (this.selectedObjects.size === 0) return;
        
            this.controls.detachFromGroup();
            this.controls.transformControls.detach();
            this.controls.clearSelectionBoxes();
            
            this.selectedObjects.forEach(obj => {
                if (obj.userData?.gameEntity?.type === 'DirectionalLight') {
                    obj.picker.material.visible = false;
                }
            });
    
            this.selectedObjects.clear();
            this.primarySelectedObject = null;
            
            this.ui.updatePropertiesPanel();
            this.ui.updateOutliner();
            
            document.getElementById('tool-rotate').disabled = false;
            document.getElementById('tool-scale').disabled = false;
        }
    
        selectByUUID(uuid) {
            const entityToSelect = [...this.app.entities].find(e => {
                const mesh = e.mesh || e.picker || e.targetHelper || e.helperMesh;
                return mesh?.uuid === uuid;
            });
            if (entityToSelect) {
                this.select(entityToSelect);
            }
        }
    
        // --- Snap Control ---
        setSnapEnabled(isEnabled) {
            this.isSnapEnabled = isEnabled;
            this.controls.applySnapSettings();
        }
        
        setTranslationSnap(value) {
            this.translationSnapValue = value || 1;
            this.controls.applySnapSettings();
        }
        
        setRotationSnap(value) {
            this.rotationSnapValue = value || 15;
            this.controls.applySnapSettings();
        }
        
        // --- Data & Property Manipulation ---
    
        updateSceneSetting(key, value) {
            const path = key.split('.');
            let target = this.app.settings;
            for (let i = 0; i < path.length - 1; i++) {
                target = target[path[i]];
            }
            target[path[path.length - 1]] = value;
            this.app.levelManager._setupScene(this.app.settings);
        }
        
        updateSelectedProp(prop, key, value) {
            if (this.selectedObjects.size === 0) return;
        
            const changes = [];
            this.selectedObjects.forEach(entity => {
                let definitionHolder = entity;
                let definitionPropPath = prop;
        
                if (entity.userData?.gameEntity?.type === 'LightTarget') {
                    definitionHolder = entity.userData.gameEntity.parentLight;
                    if (prop === 'position') {
                        definitionPropPath = 'targetPosition';
                    }
                }
        
                const beforeState = JSON.parse(JSON.stringify(definitionHolder.definition));
                const afterState = JSON.parse(JSON.stringify(beforeState));
                
                const path = definitionPropPath.split('.');
                let parentTarget = afterState;
                let canApply = true;
                for(let i = 0; i < path.length - 1; i++) {
                    if (parentTarget[path[i]] !== undefined) {
                        parentTarget = parentTarget[path[i]];
                    } else {
                        canApply = false;
                        break;
                    }
                }
                if (!canApply) return;
        
                const finalKey = path[path.length - 1];
                let targetProperty = parentTarget[finalKey];
                if (targetProperty === undefined) return;
        
                if (key !== null) {
                    targetProperty[key] = value;
                } else {
                     parentTarget[finalKey] = value.toString().startsWith('#') ? value.replace('#', '0x') : value;
                }
                
                changes.push({ entity: definitionHolder, beforeState, afterState });
            });
        
            if (changes.length > 0) {
                const command = new StateChangeCommand(this, changes);
                this.undoManager.execute(command);
            }
        }
        
        applyDefinition(obj) {
            const type = obj.userData?.gameEntity?.type;
            const def = obj.definition;
        
            if (!def || !type) return;
        
            if (type === 'SpawnPoint' || type === 'DeathSpawnPoint') {
                this.syncObjectTransforms(obj);
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
                return;
            }
    
            if (type === 'Waterfall') {
                const mesh = obj.mesh;
                mesh.position.set(def.position.x, def.position.y, def.position.z);
                if (def.rotation) {
                    mesh.rotation.set(THREE.MathUtils.degToRad(def.rotation.x || 0), THREE.MathUtils.degToRad(def.rotation.y || 0), THREE.MathUtils.degToRad(def.rotation.z || 0));
                }
                if (def.size) {
                    mesh.geometry.dispose();
                    mesh.geometry = new THREE.PlaneGeometry(def.size[0], def.size[1]);
                }
                return;
            }
    
            if (type === 'Water') {
                const size = (def.size || [1, 1, 1]).map(s => Math.abs(s) || 0.1);
                const position = def.position;
                const rot = def.rotation ? new THREE.Euler(
                    THREE.MathUtils.degToRad(def.rotation.x || 0),
                    THREE.MathUtils.degToRad(def.rotation.y || 0),
                    THREE.MathUtils.degToRad(def.rotation.z || 0), 'YXZ'
                ) : new THREE.Euler();
                const quat = new THREE.Quaternion().setFromEuler(rot);
    
                obj.helperMesh.position.set(position.x, position.y, position.z);
                obj.helperMesh.quaternion.copy(quat);
                obj.helperMesh.geometry.dispose();
                obj.helperMesh.geometry = new THREE.BoxGeometry(...size);
    
                obj.mesh.geometry.dispose();
                obj.mesh.geometry = new THREE.PlaneGeometry(size[0], size[2]);
    
                if(obj.body && obj.body.shapes[0]){
                     const halfExtents = new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2);
                     obj.body.shapes[0].halfExtents.copy(halfExtents);
                     obj.body.shapes[0].updateConvexPolyhedronRepresentation();
                     obj.body.updateBoundingRadius();
                }
                
                this.syncObjectTransforms(obj); 
                return;
            }

            if (type === 'NPC') {
                const team = def.team || 'enemy';
                const color = team === 'enemy' ? 0x990000 : 0x009933;
                obj.mesh.material.color.set(color);
        
                if (obj.body) {
                    if (team === 'enemy') {
                        obj.body.collisionFilterGroup = COLLISION_GROUPS.ENEMY;
                        obj.body.collisionFilterMask = COLLISION_GROUPS.WORLD | COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.ALLY | COLLISION_GROUPS.PLAYER_PROJECTILE | COLLISION_GROUPS.TRIGGER | COLLISION_GROUPS.WATER;
                    } else { // ally
                        obj.body.collisionFilterGroup = COLLISION_GROUPS.ALLY;
                        obj.body.collisionFilterMask = COLLISION_GROUPS.WORLD | COLLISION_GROUPS.ENEMY | COLLISION_GROUPS.ENEMY_PROJECTILE | COLLISION_GROUPS.TRIGGER | COLLISION_GROUPS.WATER;
                    }
                }
            }
            
            const mesh = obj.mesh;
            const body = obj.body;
            mesh.position.set(def.position.x, def.position.y, def.position.z);
        
            if (def.rotation && obj.isDead === undefined) {
                 mesh.rotation.set(
                    THREE.MathUtils.degToRad(def.rotation.x || 0),
                    THREE.MathUtils.degToRad(def.rotation.y || 0),
                    THREE.MathUtils.degToRad(def.rotation.z || 0)
                );
            }
        
            if (def.material?.color && mesh.material && !mesh.material.isWireframeMaterial && type !== 'NPC') {
                mesh.material.color.set(parseInt(def.material.color, 16));
            }
        
            if (def.size) {
                if (type === 'Trigger' || type === 'DeathTrigger') {
                    mesh.geometry.dispose();
                    mesh.geometry = new THREE.BoxGeometry(...def.size);
                    if (type === 'Trigger' && def.color) {
                        mesh.material.color.set(parseInt(def.color, 16));
                    }
                } else if (def.type === 'Plane') {
                    mesh.geometry.dispose();
                    mesh.geometry = new THREE.PlaneGeometry(def.size[0], def.size[1]);
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
        }
        
        syncObjectTransforms(entityToSync) {
            const entity = entityToSync || this.primarySelectedObject;
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
            } else if (entityType === 'Water') {
                const sourceTransform = entity.helperMesh;
                entity.body.position.copy(sourceTransform.position);
                entity.body.quaternion.copy(sourceTransform.quaternion);
                
                const size = entity.definition.size;
                const upVector = new THREE.Vector3(0, 1, 0);
                upVector.applyQuaternion(sourceTransform.quaternion);
        
                const waterSurfacePosition = sourceTransform.position.clone().add(upVector.multiplyScalar(size[1] / 2));
                entity.mesh.position.copy(waterSurfacePosition);
                
                entity.mesh.quaternion.copy(sourceTransform.quaternion);
                entity.mesh.rotateX(-Math.PI / 2); // Re-apply the local rotation to make it flat
    
            } else if (entity.body) {
                const sourceTransform = entity.mesh || entity.picker || entity;
                entity.body.position.copy(sourceTransform.position);
                entity.body.quaternion.copy(sourceTransform.quaternion);
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
            this.ui.setHelpersVisibility('Water', document.getElementById('view-toggle-water-volumes').checked);
        }
        
        update(deltaTime) {
            this.cameraController.update(deltaTime);
            this.controls.updateSelectionBoxes();
        }
    }