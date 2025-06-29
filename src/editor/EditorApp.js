import * as THREE from 'three';
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
        const levelData = await this.levelLoader.load('./levels/level-tutorial.json');

        this.editor = new LevelEditor(this);
        this.loadLevel(levelData);

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
    
    addDirectionalLight() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(20));

        const lightData = {
            color: "0xffffff",
            intensity: 1,
            position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z }
        };

        if (!this.settings.directionalLights) this.settings.directionalLights = [];
        this.settings.directionalLights.push(lightData);
        
        const newLight = this.levelLoader.createDirectionalLight(lightData);
        const newLightObject = this.createDirectionalLightWithHelper(newLight);
        this.directionalLights.push(newLightObject);

        this.editor.select(newLightObject);
    }
    
    removeDirectionalLight(lightObjectToRemove) {
        if (!lightObjectToRemove) return;
        const index = this.directionalLights.indexOf(lightObjectToRemove);
        if (index > -1) {
            this.scene.remove(lightObjectToRemove.light);
            this.scene.remove(lightObjectToRemove.helper);
            this.scene.remove(lightObjectToRemove.picker);

            lightObjectToRemove.helper.dispose();
            lightObjectToRemove.picker.geometry.dispose();
            lightObjectToRemove.picker.material.dispose();

            this.directionalLights.splice(index, 1);
            this.settings.directionalLights.splice(index, 1);
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
        [...this.levelObjects, ...this.enemies, ...this.triggers, ...this.deathTriggers].forEach(obj => {
            if (obj.mesh) this.scene.remove(obj.mesh);
            if (obj.body) this.physics.queueForRemoval(obj.body);
        });
        this.levelObjects = [];
        this.enemies = [];
        this.triggers = [];
        this.deathTriggers = [];

        if (this.spawnPointHelper) this.scene.remove(this.spawnPointHelper);
        this.spawnPointHelper = null;
        
        if (this.deathSpawnPointHelper) this.scene.remove(this.deathSpawnPointHelper);
        this.deathSpawnPointHelper = null;

        this.directionalLights.forEach(lightObj => this.removeDirectionalLight(lightObj));
        this.directionalLights = [];
        
        if (this.ambientLight) this.scene.remove(this.ambientLight);
        this.ambientLight = null;
    }

    animate() {
        const deltaTime = this.clock.getDelta();
        this.physics.update(deltaTime);
        this.editor.update(deltaTime);
        this.renderer.render();
    }
}