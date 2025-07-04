import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Renderer } from '../core/Renderer.js';
import { Physics } from '../core/Physics.js';
import { InputManager } from '../core/InputManager.js';
import { LevelManager } from '../game/world/LevelManager.js';
import { LevelEditor } from './LevelEditor.js';

export class EditorApp {
    constructor() {
        this.clock = new THREE.Clock();
        const canvas = document.getElementById('game-canvas');
        this.renderer = new Renderer(canvas);
        this.physics = new Physics();
        this.input = new InputManager();

        this.scene = this.renderer.scene;
        this.camera = this.renderer.camera;

        // Centralized entity management
        this.entities = new Set();
        
        this.settings = {};
        this.levelName = '';
        this.ambientLight = null;
        this.spawnPoint = new THREE.Vector3(0, 5, 10);
        this.deathSpawnPoint = new THREE.Vector3(0, 5, 12);
        this.spawnPointHelper = null;
        this.deathSpawnPointHelper = null;
        this.gridHelper = null;
    }

    // --- Entity Getters ---
    getEntities(type) {
        return [...this.entities].filter(e => e.userData?.gameEntity?.type === type);
    }
    getLevelObjects() { return this.getEntities('Object'); }
    getEnemies() { return this.getEntities('Enemy'); }
    getTriggers() { return this.getEntities('Trigger'); }
    getDeathTriggers() { return this.getEntities('DeathTrigger'); }
    getDirectionalLights() { return this.getEntities('DirectionalLight'); }
    getWaterVolumes() { return this.getEntities('Water'); }

    async init() {
        this.gridHelper = new THREE.GridHelper(200, 200, 0xcccccc, 0x888888);
        this.gridHelper.material.opacity = 0.2;
        this.gridHelper.material.transparent = true;
        this.scene.add(this.gridHelper);

        this.levelManager = new LevelManager(this);
        this.editor = new LevelEditor(this);
        this.editor.actions.newLevel();
        window.editorApp = this;
        this.renderer.renderer.setAnimationLoop(() => this.animate());
    }

    add(entity) {
        if (!entity || this.entities.has(entity)) return;

        this.entities.add(entity);
        const gameEntityType = entity.userData?.gameEntity?.type;

        if (gameEntityType === 'DirectionalLight') {
            this.scene.add(entity.light, entity.light.target, entity.helper, entity.picker, entity.targetHelper);
        } else if (gameEntityType === 'SpawnPoint' || gameEntityType === 'DeathSpawnPoint') {
             this.scene.add(entity);
        } else {
            if (entity.mesh) this.scene.add(entity.mesh);
            if (entity.helperMesh) this.scene.add(entity.helperMesh); // For water volume helpers
            if (entity.body) this.physics.addBody(entity.body);
        }
    }

    remove(entity, dispose = true) {
        if (!entity || !this.entities.has(entity)) return;
        
        const gameEntityType = entity.userData?.gameEntity?.type;

        if (gameEntityType === 'DirectionalLight') {
            this.removeDirectionalLight(entity, dispose);
        } else {
            this.removeGenericEntity(entity, dispose);
        }
        this.entities.delete(entity);
    }

    loadLevel(levelData) {
        this.clearLevel();
        const { ambientLight } = this.levelManager.build(levelData);

        this.settings = levelData.settings;
        this.levelName = levelData.name;
        this.ambientLight = ambientLight;
        
        this.createSpawnPointHelper();
        this.createDeathSpawnPointHelper();
        this.editor.onLevelLoaded();
    }

    createDirectionalLightWithHelper(light) {
        const helper = new THREE.DirectionalLightHelper(light, 5, 0xffffff);
        if (helper.lightPlane?.material) helper.lightPlane.material.depthTest = false;
        
        const picker = new THREE.Mesh( new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ visible: false }));
        picker.position.copy(light.position);

        const targetHelper = new THREE.Mesh( new THREE.SphereGeometry(0.5), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }));
        targetHelper.position.copy(light.target.position);
        
        const lightObject = { light, helper, picker, targetHelper, definition: light.userData.definition };
        
        lightObject.userData = { gameEntity: { type: 'DirectionalLight', entity: lightObject } };
        picker.userData.gameEntity = lightObject.userData.gameEntity;
        targetHelper.userData.gameEntity = { type: 'LightTarget', entity: targetHelper, parentLight: lightObject };

        return lightObject;
    }
    
    removeDirectionalLight(lightObject, dispose = true) {
        if (!lightObject) return;
        this.scene.remove(lightObject.light.target, lightObject.light, lightObject.helper, lightObject.picker, lightObject.targetHelper);
        
        if (dispose) {
            lightObject.helper.dispose();
            lightObject.picker.geometry.dispose();
            lightObject.picker.material.dispose();
            lightObject.targetHelper.geometry.dispose();
            lightObject.targetHelper.material.dispose();
            lightObject.light.dispose();
        }
    }
    
    removeGenericEntity(entity, dispose = true) {
        if (!entity) return;
        const mesh = entity.mesh || entity;
        this.scene.remove(mesh);
        if (entity.helperMesh) this.scene.remove(entity.helperMesh);
        
        if (dispose && mesh.geometry) {
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose());
            } else if (mesh.material?.dispose) {
                mesh.material.dispose();
            }
        }
        if (dispose && entity.helperMesh?.geometry) {
            entity.helperMesh.geometry.dispose();
            entity.helperMesh.material.dispose();
        }
        if (entity.body) this.physics.queueForRemoval(entity.body);
    }

    createSpawnPointHelper() {
        const helper = new THREE.AxesHelper(2);
        helper.material.depthTest = false;
        helper.position.copy(this.spawnPoint);
        helper.add(new THREE.Mesh( new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.5 })));
        helper.userData.gameEntity = { type: 'SpawnPoint', entity: helper };
        helper.children[0].userData.gameEntity = helper.userData.gameEntity;
        this.spawnPointHelper = helper;
        this.add(helper);
    }

    createDeathSpawnPointHelper() {
        const helper = new THREE.AxesHelper(2);
        helper.material.depthTest = false;
        helper.position.copy(this.deathSpawnPoint);
        helper.add(new THREE.Mesh( new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 })));
        helper.userData.gameEntity = { type: 'DeathSpawnPoint', entity: helper };
        helper.children[0].userData.gameEntity = helper.userData.gameEntity;
        this.deathSpawnPointHelper = helper;
        this.add(helper);
    }

    clearLevel() {
        this.editor.deselect();
        [...this.entities].forEach(entity => this.remove(entity));
        this.entities.clear();
        this.spawnPointHelper = null;
        this.deathSpawnPointHelper = null;
        if (this.ambientLight) {
            this.scene.remove(this.ambientLight);
            this.ambientLight.dispose();
            this.ambientLight = null;
        }
    }

    animate() {
        const deltaTime = this.clock.getDelta();
        const elapsedTime = this.clock.elapsedTime;
        [...this.getWaterVolumes()].forEach(water => {
            if (water.mesh?.material?.uniforms?.time) {
                water.mesh.material.uniforms.time.value = elapsedTime;
            }
        });
        this.physics.update(deltaTime);
        this.editor.update(deltaTime);
        this.renderer.render();
    }
}