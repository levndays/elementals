import * as THREE from 'three';
import { StateChangeCommand } from './UndoManager.js';

export class EditorActions {
    constructor(editor) {
        this.editor = editor;
        this.app = editor.app;
        this.camera = editor.camera;
    }

    _createAndExecuteCreationCommand(entity, list) {
        list.push(entity);
        
        const beforeState = null; // No state before creation
        const afterState = entity.definition;
        
        const command = {
            entity: entity,
            execute: () => {
                if (!list.includes(entity)) list.push(entity);
                this.app.scene.add(entity.mesh);
                if (entity.body) this.app.physics.world.addBody(entity.body);
                this.editor.select(entity);
            },
            undo: () => {
                const index = list.indexOf(entity);
                if (index > -1) list.splice(index, 1);
                this.app.scene.remove(entity.mesh);
                if (entity.body) this.app.physics.queueForRemoval(entity.body);
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
        const newObj = this.app.levelLoader.createObject(boxData);
        this._createAndExecuteCreationCommand(newObj, this.app.levelObjects);
    }
    
    addEnemy() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(10));
        const enemyData = { type: "Dummy", position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z } };
        const newEnemy = this.app.levelLoader.createEnemy(enemyData);
        this._createAndExecuteCreationCommand(newEnemy, this.app.enemies);
    }

    addMessageTrigger() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(10));
        const triggerData = {
            type: "Trigger", name: `MessageTrigger_${Date.now()}`, size: [5, 5, 5],
            position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
            message: "This is a test message.",
            duration: 5,
            color: "0x00ff00"
        };
        const newTrigger = this.app.createTrigger(triggerData);
        this._createAndExecuteCreationCommand(newTrigger, this.app.triggers);
    }

    addDeathTrigger() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(10));
        const triggerData = {
            type: "DeathTrigger", name: `DeathZone_${Date.now()}`, size: [10, 2, 10],
            position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z }
        };
        const newTrigger = this.app.createDeathTrigger(triggerData);
        this._createAndExecuteCreationCommand(newTrigger, this.app.deathTriggers);
    }

    deleteSelected() {
        if (!this.editor.selectedObject) return;
        const entity = this.editor.selectedObject;
        const entityType = entity.userData.gameEntity.type;
        
        if (['SpawnPoint', 'DeathSpawnPoint'].includes(entityType)) return;

        let list;
        switch (entityType) {
            case 'Trigger':       list = this.app.triggers; break;
            case 'DeathTrigger':  list = this.app.deathTriggers; break;
            case 'DirectionalLight': 
                this.app.removeDirectionalLight(entity);
                this.editor.deselect();
                // TODO: Add undo/redo for light creation/deletion
                return;
            case 'Enemy':         list = this.app.enemies; break;
            default:              list = this.app.levelObjects; break;
        }

        const command = {
            entity: entity,
            execute: () => {
                const index = list.indexOf(entity);
                if (index > -1) list.splice(index, 1);
                this.app.scene.remove(entity.mesh);
                if (entity.body) this.app.physics.queueForRemoval(entity.body);
                this.editor.deselect();
            },
            undo: () => {
                if (!list.includes(entity)) list.push(entity);
                this.app.scene.add(entity.mesh);
                if (entity.body) this.app.physics.world.addBody(entity.body);
                this.editor.select(entity);
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

        if (['Object', 'Enemy', 'Trigger', 'DeathTrigger'].includes(entityType)) {
            // Apply scale before syncing other transforms to ensure correct data is copied
            this._bakeScaleIntoDefinition(entity);
            this.editor.syncObjectTransforms(); 

            if (entityType === 'Object') {
                const rot = new THREE.Euler().setFromQuaternion(entity.mesh.quaternion, 'YXZ');
                entity.definition.rotation = {x: THREE.MathUtils.radToDeg(rot.x), y: THREE.MathUtils.radToDeg(rot.y), z: THREE.MathUtils.radToDeg(rot.z)};
            }
            this.editor.clipboard = JSON.parse(JSON.stringify(entity.definition));
            if (!this.editor.clipboard.type) this.editor.clipboard.type = entityType;
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
        let list;

        switch(newDef.type) {
            case 'Dummy':         
                newEntity = this.app.levelLoader.createEnemy(newDef); 
                list = this.app.enemies;
                break;
            case 'Trigger':       
                newEntity = this.app.createTrigger(newDef);
                list = this.app.triggers;
                break;
            case 'DeathTrigger':  
                newEntity = this.app.createDeathTrigger(newDef);
                list = this.app.deathTriggers;
                break;
            default:              
                newEntity = this.app.levelLoader.createObject(newDef);
                list = this.app.levelObjects;
                break;
        }
        
        if (newEntity) this._createAndExecuteCreationCommand(newEntity, list);
    }

    loadFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try { this.app.loadLevel(JSON.parse(e.target.result)); } 
            catch (err) { alert("Invalid level file."); }
        };
        reader.readAsText(file);
    }

    saveFile() {
        // --- PRE-SAVE SYNC ---
        // Ensure all entities have their definitions updated from their editor state.
        
        // Bake scale for any scaled objects first.
        this.app.levelObjects.forEach(obj => this._bakeScaleIntoDefinition(obj));

        // Sync standard mesh-based entities (Objects, Enemies, Triggers)
        [...this.app.levelObjects, ...this.app.enemies, ...this.app.triggers, ...this.app.deathTriggers].forEach(obj => {
            if (!obj.definition) return;
            obj.definition.position = { x: obj.mesh.position.x, y: obj.mesh.position.y, z: obj.mesh.position.z };
            if (obj.definition.rotation) {
                const rot = new THREE.Euler().setFromQuaternion(obj.mesh.quaternion, 'YXZ');
                obj.definition.rotation = { x: THREE.MathUtils.radToDeg(rot.x), y: THREE.MathUtils.radToDeg(rot.y), z: THREE.MathUtils.radToDeg(rot.z) };
            }
        });

        // Sync directional lights
        this.app.directionalLights.forEach(lightObj => {
            lightObj.definition.position = { x: lightObj.light.position.x, y: lightObj.light.position.y, z: lightObj.light.position.z };
            lightObj.definition.targetPosition = { x: lightObj.light.target.position.x, y: lightObj.light.target.position.y, z: lightObj.light.target.position.z };
        });

        // --- SERIALIZATION ---
        const levelData = {
            name: "Custom Level",
            spawnPoint: { x: this.app.spawnPointHelper.position.x, y: this.app.spawnPointHelper.position.y, z: this.app.spawnPointHelper.position.z },
            deathSpawnPoint: { x: this.app.deathSpawnPointHelper.position.x, y: this.app.deathSpawnPointHelper.position.y, z: this.app.deathSpawnPointHelper.position.z },
            settings: this.app.settings,
            objects: this.app.levelObjects.map(obj => obj.definition),
            enemies: this.app.enemies.map(enemy => enemy.definition),
            triggers: this.app.triggers.map(t => t.definition),
            deathTriggers: this.app.deathTriggers.map(t => t.definition)
        };
        
        const blob = new Blob([JSON.stringify(levelData, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'custom-level.json';
        a.click();
        URL.revokeObjectURL(a.href);
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