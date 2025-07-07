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

    addWaterVolume() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(15));
        const waterData = {
            type: "Water",
            name: `WaterVolume_${Date.now()}`,
            size: [20, 5, 20],
            position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
            rotation: { x: 0, y: 0, z: 0 }
        };
        const newWater = this.app.levelManager.createObject(waterData);
        this._createAndExecuteCreationCommand(newWater);
    }
    
    addWaterfall() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(15));
        const waterfallData = {
            type: "Waterfall",
            name: `Waterfall_${Date.now()}`,
            size: [10, 20],
            position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
            rotation: { x: 0, y: 0, z: 0 }
        };
        const newWaterfall = this.app.levelManager.createObject(waterfallData);
        this._createAndExecuteCreationCommand(newWaterfall);
    }

    addEnemy() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(10));
        const enemyData = { type: "Dummy", team: "enemy", position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z } };
        const newEnemy = this.app.levelManager.createNPC(enemyData);
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
        if (this.editor.selectedObjects.size === 0) return;

        const entitiesToDelete = [...this.editor.selectedObjects].filter(entity => {
            const entityType = entity.userData.gameEntity.type;
            return !['SpawnPoint', 'DeathSpawnPoint'].includes(entityType);
        });
    
        if (entitiesToDelete.length === 0) return;
    
        const definitions = entitiesToDelete.map(entity => JSON.parse(JSON.stringify(entity.definition)));
        let recreatedEntities = [];
    
        const command = {
            execute: () => {
                const targets = recreatedEntities.length > 0 ? recreatedEntities : entitiesToDelete;
                targets.forEach(entity => this.app.remove(entity));
                this.editor.deselect();
                recreatedEntities = [];
            },
            undo: () => {
                this.editor.deselect();
                definitions.forEach(def => {
                    const newEntity = this.app.levelManager.recreateEntity(def);
                    if (newEntity) {
                        recreatedEntities.push(newEntity);
                        this.app.add(newEntity);
                        this.editor.addToSelection(newEntity);
                    }
                });
            }
        };
        this.editor.undoManager.execute(command);
    }
    
    _bakeScaleIntoDefinition(entity) {
        const transformSource = entity.helperMesh || entity.mesh;
        if (entity && transformSource && entity.definition?.size) {
            const scale = transformSource.scale;
            if (scale.x !== 1 || scale.y !== 1 || scale.z !== 1) {
                if (entity.definition.type === 'Plane' || entity.definition.type === 'Waterfall') {
                    entity.definition.size[0] *= scale.x;
                    entity.definition.size[1] *= scale.y;
                } else {
                    entity.definition.size[0] *= scale.x;
                    entity.definition.size[1] *= scale.y;
                    entity.definition.size[2] *= scale.z;
                }
                scale.set(1, 1, 1);
                this.editor.applyDefinition(entity);
            }
        }
    }
    
    copySelected() {
        if (this.editor.selectedObjects.size === 0) return;
    
        const clipboardData = {
            centroid: new THREE.Vector3(),
            definitions: []
        };
        const tempCentroid = new THREE.Vector3();
        let validObjects = 0;
    
        this.editor.selectedObjects.forEach(entity => {
            const entityType = entity.userData?.gameEntity?.type;
            const validTypes = ['Object', 'Enemy', 'Trigger', 'DeathTrigger', 'Water', 'Waterfall'];
    
            if (validTypes.includes(entityType)) {
                this._bakeScaleIntoDefinition(entity);
                this.editor.syncObjectTransforms(entity);
    
                const mesh = entity.helperMesh || entity.mesh || entity.picker || entity;
                tempCentroid.add(mesh.position);
                validObjects++;
                
                if (entity.definition.rotation) {
                    const rot = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'YXZ');
                    entity.definition.rotation = {
                        x: THREE.MathUtils.radToDeg(rot.x),
                        y: THREE.MathUtils.radToDeg(rot.y),
                        z: THREE.MathUtils.radToDeg(rot.z)
                    };
                }
    
                clipboardData.definitions.push(JSON.parse(JSON.stringify(entity.definition)));
            }
        });
    
        if (validObjects > 0) {
            tempCentroid.divideScalar(validObjects);
            clipboardData.centroid = tempCentroid.toArray();
            this.editor.clipboard = clipboardData;
        } else {
            this.editor.clipboard = null;
        }
    }

    pasteFromClipboard() {
        if (!this.editor.clipboard || !this.editor.clipboard.definitions || this.editor.clipboard.definitions.length === 0) return;
    
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const newCenter = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(15));
        
        const originalCenter = new THREE.Vector3().fromArray(this.editor.clipboard.centroid);
        const createdEntities = [];
        const definitionsToCreate = this.editor.clipboard.definitions;
    
        const command = {
            execute: () => {
                this.editor.deselect();
                definitionsToCreate.forEach(def => {
                    const newDef = JSON.parse(JSON.stringify(def));
                    const originalPos = new THREE.Vector3().copy(newDef.position);
                    const offset = new THREE.Vector3().subVectors(originalPos, originalCenter);
                    
                    newDef.position = { x: newCenter.x + offset.x, y: newCenter.y + offset.y, z: newCenter.z + offset.z };
                    newDef.name = `${newDef.name || newDef.type}_copy_${Math.floor(Math.random() * 1000)}`;
                    
                    let newEntity;
                    switch(newDef.type) {
                        case 'Dummy': newEntity = this.app.levelManager.createNPC(newDef); break;
                        case 'Trigger': newEntity = this.app.levelManager.createTrigger(newDef, 'Trigger'); break;
                        case 'DeathTrigger': newEntity = this.app.levelManager.createTrigger(newDef, 'DeathTrigger'); break;
                        case 'Water':
                        case 'Waterfall':
                        default: newEntity = this.app.levelManager.createObject(newDef); break;
                    }
    
                    if (newEntity) {
                        this.app.add(newEntity);
                        this.editor.addToSelection(newEntity);
                        createdEntities.push(newEntity);
                    }
                });
            },
            undo: () => {
                createdEntities.forEach(entity => this.app.remove(entity));
                createdEntities.length = 0;
                this.editor.deselect();
            }
        };
    
        this.editor.undoManager.execute(command);
    }

    async newLevel() {
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
            npcs: [],
            triggers: [],
            deathTriggers: []
        };
        await this.app.loadLevel(newLevelData);
    }

    loadFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try { 
                await this.app.loadLevel(JSON.parse(e.target.result)); 
            } 
            catch (err) { 
                alert("Invalid level file."); 
                console.error("Error loading level:", err); 
            }
        };
        reader.readAsText(file);
    }

    getSerializableLevelData() {
        const entities = [...this.app.entities];
        
        entities.forEach(obj => {
            this._bakeScaleIntoDefinition(obj);
            const transformSource = obj.helperMesh || obj.mesh || obj.picker;
            if (!obj.definition || !transformSource) return;

            obj.definition.position = { x: transformSource.position.x, y: transformSource.position.y, z: transformSource.position.z };
            if (obj.definition.rotation) {
                const rot = new THREE.Euler().setFromQuaternion(transformSource.quaternion, 'YXZ');
                obj.definition.rotation = { x: THREE.MathUtils.radToDeg(rot.x), y: THREE.MathUtils.radToDeg(rot.y), z: THREE.MathUtils.radToDeg(rot.z) };
            }
        });

        this.app.getDirectionalLights().forEach(lightObj => {
            lightObj.definition.position = { x: lightObj.light.position.x, y: lightObj.light.position.y, z: lightObj.light.position.z };
            lightObj.definition.targetPosition = { x: lightObj.light.target.position.x, y: lightObj.light.target.position.y, z: lightObj.light.target.position.z };
        });

        const geometricObjects = [
            ...this.app.getLevelObjects(),
            ...this.app.getWaterVolumes(),
            ...this.app.getWaterfalls()
        ];

        const levelData = {
            name: this.app.levelName || "Custom Level",
            spawnPoint: { x: this.app.spawnPointHelper.position.x, y: this.app.spawnPointHelper.position.y, z: this.app.spawnPointHelper.position.z },
            deathSpawnPoint: { x: this.app.deathSpawnPointHelper.position.x, y: this.app.deathSpawnPointHelper.position.y, z: this.app.deathSpawnPointHelper.position.z },
            settings: this.app.settings,
            objects: geometricObjects.map(obj => obj.definition),
            npcs: this.app.getEnemies().map(enemy => enemy.definition),
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
    
    setSpawnPointToCamera() { this.camera.getWorldPosition(this.app.spawnPointHelper.position); this.editor.syncObjectTransforms(this.app.spawnPointHelper); }
    setDeathSpawnPointToCamera() { this.camera.getWorldPosition(this.app.deathSpawnPointHelper.position); this.editor.syncObjectTransforms(this.app.deathSpawnPointHelper); }
}