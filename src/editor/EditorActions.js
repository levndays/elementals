// ~ src/editor/EditorActions.js

import * as THREE from 'three';
import { StateChangeCommand } from './UndoManager.js';

export class EditorActions {
    constructor(editor) {
        this.editor = editor;
        this.app = editor.app;
        this.camera = editor.camera;
    }

    _createAndExecuteCreationCommand(entity) {
        const command = {
            execute: () => {
                this.app.add(entity);
                this.editor.select(entity);
            },
            undo: () => {
                // Remove without disposing so it can be redone
                this.app.remove(entity, false);
                this.editor.deselect();
            }
        };
        this.editor.undoManager.execute(command);
    }

    addBox() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(10));
        const boxData = {
            type: "Box", name: `Box_${Date.now()}`, size: [2, 2, 2],
            position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
            rotation: { x: 0, y: 0, z: 0 },
            material: { color: "0xcccccc" }, physics: { mass: 0 }
        };
        const newObj = this.app.levelManager.createObject(boxData);
        this._createAndExecuteCreationCommand(newObj);
    }
    
    addEnemy() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(10));
        const enemyData = { type: "Dummy", position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z } };
        const newEnemy = this.app.levelManager.createEnemy(enemyData);
        this._createAndExecuteCreationCommand(newEnemy);
    }

    addMessageTrigger() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(10));
        const triggerData = {
            type: "Trigger", name: `MessageTrigger_${Date.now()}`, size: [5, 5, 5],
            position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
            rotation: { x: 0, y: 0, z: 0 },
            message: "This is a test message.",
            duration: 5,
            color: "0x00ff00"
        };
        const newTrigger = this.app.levelManager.createTrigger(triggerData, 'Trigger');
        this._createAndExecuteCreationCommand(newTrigger);
    }

    addDeathTrigger() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(10));
        const triggerData = {
            type: "DeathTrigger", name: `DeathZone_${Date.now()}`, size: [10, 2, 10],
            position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
            rotation: { x: 0, y: 0, z: 0 },
        };
        const newTrigger = this.app.levelManager.createTrigger(triggerData, 'DeathTrigger');
        this._createAndExecuteCreationCommand(newTrigger);
    }

    addDirectionalLight() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(20));

        const lightData = {
            color: "0xffffff",
            intensity: 1,
            position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
            targetPosition: { x: 0, y: 0, z: 0 }
        };
        
        const newLight = this.app.levelManager.createDirectionalLight(lightData);
        const newLightObject = this.app.createDirectionalLightWithHelper(newLight);
        this._createAndExecuteCreationCommand(newLightObject);
    }

    deleteSelected() {
        if (!this.editor.selectedObject) return;
        const entity = this.editor.selectedObject;
        const entityType = entity.userData.gameEntity.type;
        
        if (['SpawnPoint', 'DeathSpawnPoint'].includes(entityType)) return;
    
        const definition = JSON.parse(JSON.stringify(entity.definition));
        let recreatedEntity = null; // Closure variable
    
        const command = {
            execute: () => {
                const entityToRemove = recreatedEntity || entity;
                this.app.remove(entityToRemove);
                this.editor.deselect();
                recreatedEntity = null;
            },
            undo: () => {
                recreatedEntity = this.app.levelManager.recreateEntity(definition);
                if (recreatedEntity) {
                    this.app.add(recreatedEntity);
                    this.editor.select(recreatedEntity);
                }
            }
        };
        this.editor.undoManager.execute(command);
    }
    
    _bakeScaleIntoDefinition(entity) {
        if (entity && entity.mesh && entity.definition?.size) {
            const scale = entity.mesh.scale;
            if (scale.x !== 1 || scale.y !== 1 || scale.z !== 1) {
                entity.definition.size[0] *= scale.x;
                entity.definition.size[1] *= scale.y;
                entity.definition.size[2] *= scale.z;
                scale.set(1, 1, 1);
                this.editor.applyDefinition(entity);
            }
        }
    }
    
    copySelected() {
        if (!this.editor.selectedObject) return;
        
        const entity = this.editor.selectedObject;
        const entityType = entity.userData?.gameEntity?.type;
        const validTypes = ['Object', 'Enemy', 'Trigger', 'DeathTrigger'];
    
        if (validTypes.includes(entityType)) {
            this._bakeScaleIntoDefinition(entity); // Bake scale into definition size
            this.editor.syncObjectTransforms(); // Sync position to definition
    
            // Manually sync rotation into definition
            if (entity.definition.rotation) {
                const rot = new THREE.Euler().setFromQuaternion(entity.mesh.quaternion, 'YXZ');
                entity.definition.rotation = {
                    x: THREE.MathUtils.radToDeg(rot.x),
                    y: THREE.MathUtils.radToDeg(rot.y),
                    z: THREE.MathUtils.radToDeg(rot.z)
                };
            }
            
            this.editor.clipboard = JSON.parse(JSON.stringify(entity.definition));
        } else {
            this.editor.clipboard = null;
        }
    }

    pasteFromClipboard() {
        if (!this.editor.clipboard) return;

        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(15));
        
        const newDef = JSON.parse(JSON.stringify(this.editor.clipboard));
        newDef.position = { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z };
        newDef.name = `${newDef.name || newDef.type}_copy`;

        let newEntity;
        switch(newDef.type) {
            case 'Dummy':
                newEntity = this.app.levelManager.createEnemy(newDef);
                break;
            case 'Trigger':
                newEntity = this.app.levelManager.createTrigger(newDef, 'Trigger');
                break;
            case 'DeathTrigger':
                newEntity = this.app.levelManager.createTrigger(newDef, 'DeathTrigger');
                break;
            default:
                newEntity = this.app.levelManager.createObject(newDef);
                break;
        }
        
        if (newEntity) this._createAndExecuteCreationCommand(newEntity);
    }

    newLevel() {
        const newLevelData = {
            name: "New Level",
            spawnPoint: { x: 0, y: 3, z: 0 },
            deathSpawnPoint: { x: 0, y: 3, z: 0 },
            settings: {
                backgroundColor: "0x1d2938",
                fogColor: "0x1d2938",
                fogNear: 20,
                fogFar: 150,
                ambientLight: {
                    color: "0x607080",
                    intensity: 0.7
                },
                directionalLights: [
                    {
                        color: "0xffffff",
                        intensity: 1.5,
                        position: { x: -0.19, y: 100, z: 94.33 },
                        targetPosition: { x: 0, y: 0, z: 0 }
                    }
                ]
            },
            objects: [
                {
                    "type": "Plane",
                    "name": "Ground Plane",
                    "size": [200, 200],
                    "position": { "x": 0, "y": 0, "z": 0 },
                    "rotation": { "x": -90, "y": 0, "z": 0 },
                    "material": { "color": "0x334455", "roughness": 0.9 },
                    "physics": { "mass": 0 },
                    "editorSelectable": false
                }
            ],
            enemies: [],
            triggers: [],
            deathTriggers: []
        };
        this.app.loadLevel(newLevelData);
    }

    loadFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try { this.app.loadLevel(JSON.parse(e.target.result)); } 
            catch (err) { alert("Invalid level file."); console.error("Error loading level:", err); }
        };
        reader.readAsText(file);
    }

    getSerializableLevelData() {
        const entities = [...this.app.entities];
        
        entities.forEach(obj => {
            this._bakeScaleIntoDefinition(obj);
            if (!obj.definition || !obj.mesh) return;
            obj.definition.position = { x: obj.mesh.position.x, y: obj.mesh.position.y, z: obj.mesh.position.z };
            if (obj.definition.rotation) {
                const rot = new THREE.Euler().setFromQuaternion(obj.mesh.quaternion, 'YXZ');
                obj.definition.rotation = { x: THREE.MathUtils.radToDeg(rot.x), y: THREE.MathUtils.radToDeg(rot.y), z: THREE.MathUtils.radToDeg(rot.z) };
            }
        });

        this.app.getDirectionalLights().forEach(lightObj => {
            lightObj.definition.position = { x: lightObj.light.position.x, y: lightObj.light.position.y, z: lightObj.light.position.z };
            lightObj.definition.targetPosition = { x: lightObj.light.target.position.x, y: lightObj.light.target.position.y, z: lightObj.light.target.position.z };
        });

        const levelData = {
            name: this.app.levelName || "Custom Level",
            spawnPoint: { x: this.app.spawnPointHelper.position.x, y: this.app.spawnPointHelper.position.y, z: this.app.spawnPointHelper.position.z },
            deathSpawnPoint: { x: this.app.deathSpawnPointHelper.position.x, y: this.app.deathSpawnPointHelper.position.y, z: this.app.deathSpawnPointHelper.position.z },
            settings: this.app.settings,
            objects: this.app.getLevelObjects().map(obj => obj.definition),
            enemies: this.app.getEnemies().map(enemy => enemy.definition),
            triggers: this.app.getTriggers().map(t => t.definition),
            deathTriggers: this.app.getDeathTriggers().map(t => t.definition)
        };
        return levelData;
    }

    saveFile() {
        const levelData = this.getSerializableLevelData();
        const blob = new Blob([JSON.stringify(levelData, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${levelData.name.toLowerCase().replace(/\s/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    playInDebugMode() {
        const levelData = this.getSerializableLevelData();
        try {
            localStorage.setItem('editorLevelData', JSON.stringify(levelData));
            window.location.href = 'index.html?loadFromEditor=true&debug=true';
        } catch (e) {
            console.error("Failed to save level to localStorage:", e);
            alert("Could not play level in debug mode. Level data might be too large.");
        }
    }
    
    updateSkyboxColor(color) {
        this.app.scene.background = new THREE.Color(color);
        this.app.settings.backgroundColor = color.replace('#', '0x');
    }
    
    updateAmbientLight(prop, value) {
        const light = this.app.ambientLight;
        const setting = this.app.settings.ambientLight;
        if (prop === 'color') { light.color.set(value); setting.color = value.replace('#', '0x'); }
        if (prop === 'intensity') { light.intensity = parseFloat(value); setting.intensity = parseFloat(value); }
    }
    
    setSpawnPointToCamera() { this.camera.getWorldPosition(this.app.spawnPointHelper.position); this.editor.syncObjectTransforms(); }
    setDeathSpawnPointToCamera() { this.camera.getWorldPosition(this.app.deathSpawnPointHelper.position); this.editor.syncObjectTransforms(); }
}