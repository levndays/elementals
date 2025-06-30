import * as THREE from 'three';
import * as CANNON from 'cannon-es'; // Import CANNON for body types
import { Renderer } from '../engine/Renderer.js';
import { Physics } from '../engine/Physics.js';
import { InputManager } from '../engine/InputManager.js';
import { LevelLoader } from '../world/LevelLoader.js';
import { LevelEditor } from './LevelEditor.js';

export class EditorApp {
    constructor() {
        this.clock = new THREE.Clock();
        this.renderer = new Renderer();
        this.physics = new Physics();
        this.input = new InputManager();

        this.scene = this.renderer.scene;
        this.camera = this.renderer.camera;

        this.updatables = [];
        this.levelObjects = [];
        this.enemies = [];
        this.triggers = [];
        this.deathTriggers = [];
        
        this.spawnPoint = { x: 0, y: 5, z: 10 };
        this.spawnPointHelper = null;
        this.deathSpawnPoint = { x: 0, y: 5, z: 12 };
        this.deathSpawnPointHelper = null;

        this.settings = {};
        this.ambientLight = null;
        this.directionalLights = []; // Now stores { light, helper, picker, definition }
    }

    async init() {
        this.levelLoader = new LevelLoader(this);
        
        this.editor = new LevelEditor(this);
        this.editor.actions.newLevel(); // Load a new empty level by default

        window.editorApp = this;
        this.renderer.renderer.setAnimationLoop(() => this.animate());
    }

    loadLevel(levelData) {
        this.clearLevel();
        const { levelObjects, enemies, ambientLight, directionalLights, triggers, deathTriggers } = this.levelLoader.build(levelData);
        
        this.levelObjects = levelObjects;
        this.enemies = enemies;
        this.triggers = (triggers || []).map(triggerData => this.createTrigger(triggerData));
        this.deathTriggers = (deathTriggers || []).map(triggerData => this.createDeathTrigger(triggerData));
        this.spawnPoint = { ...levelData.spawnPoint };
        this.deathSpawnPoint = { ...(levelData.deathSpawnPoint || levelData.spawnPoint) };
        this.settings = levelData.settings;
        this.ambientLight = ambientLight;
        this.directionalLights = directionalLights.map(light => this.createDirectionalLightWithHelper(light));

        // FIX: Ensure enemies are static in the editor
        this.enemies.forEach(enemy => {
            if (enemy.body) {
                enemy.body.type = CANNON.Body.STATIC;
                enemy.body.mass = 0;
            }
        });

        this.createSpawnPointHelper();
        this.createDeathSpawnPointHelper();
        this.editor.setLevelData(this.levelObjects, this.enemies, this.triggers, this.deathTriggers);
    }

    createTrigger(triggerData) {
        const geometry = new THREE.BoxGeometry(...triggerData.size);
        const material = new THREE.MeshBasicMaterial({
            color: parseInt(triggerData.color || "0x00ff00", 16),
            transparent: true,
            opacity: 0.35,
            wireframe: true,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(triggerData.position.x, triggerData.position.y, triggerData.position.z);
        if (triggerData.rotation) { // Apply rotation if present
            mesh.rotation.set(
                THREE.MathUtils.degToRad(triggerData.rotation.x || 0),
                THREE.MathUtils.degToRad(triggerData.rotation.y || 0),
                THREE.MathUtils.degToRad(triggerData.rotation.z || 0)
            );
        }
        
        const triggerObject = {
            mesh,
            definition: triggerData
        };

        triggerObject.userData = { gameEntity: { type: 'Trigger', entity: triggerObject } };
        mesh.userData.gameEntity = triggerObject.userData.gameEntity;

        this.scene.add(mesh);
        return triggerObject;
    }

    createDeathTrigger(triggerData) {
        const geometry = new THREE.BoxGeometry(...triggerData.size);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000, // Red for death
            transparent: true,
            opacity: 0.35,
            wireframe: true,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(triggerData.position.x, triggerData.position.y, triggerData.position.z);
        if (triggerData.rotation) { // Apply rotation if present
            mesh.rotation.set(
                THREE.MathUtils.degToRad(triggerData.rotation.x || 0),
                THREE.MathUtils.degToRad(triggerData.rotation.y || 0),
                THREE.MathUtils.degToRad(triggerData.rotation.z || 0)
            );
        }
        
        const triggerObject = {
            mesh,
            definition: triggerData
        };

        triggerObject.userData = { gameEntity: { type: 'DeathTrigger', entity: triggerObject } };
        mesh.userData.gameEntity = triggerObject.userData.gameEntity;

        this.scene.add(mesh);
        return triggerObject;
    }

    createDirectionalLightWithHelper(light) {
        const helper = new THREE.DirectionalLightHelper(light, 5, 0xffffff);
        if (helper.lightPlane && helper.lightPlane.material) {
            helper.lightPlane.material.depthTest = false;
        }
        this.scene.add(helper);

        const picker = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        picker.position.copy(light.position);
        this.scene.add(picker);
        
        const lightObject = { light, helper, picker, definition: light.userData.definition };
        lightObject.userData = { gameEntity: { type: 'DirectionalLight', entity: lightObject } };
        picker.userData.gameEntity = lightObject.userData.gameEntity;

        return lightObject;
    }
    
    // NOTE: For full undo/redo, removing lights needs a command that captures the state to re-add it.
    // The current implementation directly removes, which is fine for its purpose, but not undoable.
    removeDirectionalLight(lightObjectToRemove) {
        if (!lightObjectToRemove) return;
        const index = this.directionalLights.indexOf(lightObjectToRemove);
        if (index > -1) {
            this.scene.remove(lightObjectToRemove.light.target);
            this.scene.remove(lightObjectToRemove.light);
            this.scene.remove(lightObjectToRemove.helper);
            this.scene.remove(lightObjectToRemove.picker);

            // Clean up Three.js resources
            lightObjectToRemove.helper.dispose();
            lightObjectToRemove.picker.geometry.dispose();
            lightObjectToRemove.picker.material.dispose();
            lightObjectToRemove.light.dispose(); // Dispose the light itself too

            // Remove from the settings definition array
            const defIndex = this.settings.directionalLights.indexOf(lightObjectToRemove.definition);
            if (defIndex > -1) this.settings.directionalLights.splice(defIndex, 1);

            this.directionalLights.splice(index, 1);
        }
    }

    createSpawnPointHelper() {
        if (this.spawnPointHelper) this.scene.remove(this.spawnPointHelper);
        
        const helper = new THREE.AxesHelper(2);
        helper.material.depthTest = false;
        helper.position.set(this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z);

        const pickerBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.5), 
            new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 })
        );
        helper.add(pickerBox);
        
        helper.userData.gameEntity = { type: 'SpawnPoint', entity: helper };
        pickerBox.userData.gameEntity = helper.userData.gameEntity;
        
        this.spawnPointHelper = helper;
        this.scene.add(this.spawnPointHelper);
    }

    createDeathSpawnPointHelper() {
        if (this.deathSpawnPointHelper) this.scene.remove(this.deathSpawnPointHelper);
        
        const helper = new THREE.AxesHelper(2);
        helper.material.depthTest = false;
        helper.position.set(this.deathSpawnPoint.x, this.deathSpawnPoint.y, this.deathSpawnPoint.z);
    
        const pickerBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.5), 
            new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 }) // Red color
        );
        helper.add(pickerBox);
        
        helper.userData.gameEntity = { type: 'DeathSpawnPoint', entity: helper };
        pickerBox.userData.gameEntity = helper.userData.gameEntity;
        
        this.deathSpawnPointHelper = helper;
        this.scene.add(this.deathSpawnPointHelper);
    }

    clearLevel() {
        this.editor.deselect(); // Deselect any object before clearing

        [...this.levelObjects, ...this.enemies, ...this.triggers, ...this.deathTriggers].forEach(obj => {
            if (obj.mesh) {
                this.scene.remove(obj.mesh);
                // Dispose resources
                if (obj.mesh.geometry) obj.mesh.geometry.dispose();
                if (obj.mesh.material) {
                    // If material is shared, don't dispose. Here, assuming unique for simplicity.
                    if (Array.isArray(obj.mesh.material)) {
                        obj.mesh.material.forEach(m => m.dispose());
                    } else {
                        obj.mesh.material.dispose();
                    }
                }
            }
            if (obj.body) this.physics.queueForRemoval(obj.body);
        });
        this.levelObjects = [];
        this.enemies = [];
        this.triggers = [];
        this.deathTriggers = [];

        if (this.spawnPointHelper) {
            this.scene.remove(this.spawnPointHelper);
            this.spawnPointHelper.children.forEach(c => c.geometry?.dispose());
            this.spawnPointHelper.children.forEach(c => c.material?.dispose());
            this.spawnPointHelper.material?.dispose(); // AxesHelper has a material
        }
        this.spawnPointHelper = null;
        
        if (this.deathSpawnPointHelper) {
            this.scene.remove(this.deathSpawnPointHelper);
            this.deathSpawnPointHelper.children.forEach(c => c.geometry?.dispose());
            this.deathSpawnPointHelper.children.forEach(c => c.material?.dispose());
            this.deathSpawnPointHelper.material?.dispose();
        }
        this.deathSpawnPointHelper = null;

        // Dispose existing lights and their helpers/pickers
        this.directionalLights.forEach(lightObj => this.removeDirectionalLight(lightObj));
        this.directionalLights = []; // Ensure array is empty

        if (this.ambientLight) {
            this.scene.remove(this.ambientLight);
            this.ambientLight.dispose();
        }
        this.ambientLight = null;
    }

    animate() {
        const deltaTime = this.clock.getDelta();
        this.physics.update(deltaTime);

        // Update entities like enemies to sync their mesh positions
        // (Though enemies are static in editor, their mesh might still need to sync if gizmo moved it)
        for (const updatable of this.updatables) {
            updatable.update(deltaTime);
        }

        this.editor.update(deltaTime);
        this.renderer.render();
    }
}