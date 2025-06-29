import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { COLLISION_GROUPS } from '../common/CollisionGroups.js';
import { Enemy } from '../game/entities/Enemy.js';

export class LevelLoader {
    constructor(game) {
        this.game = game;
        this.scene = game.renderer.scene;
        this.world = game.physics.world;
        this.spawnPoint = null;
        this.deathSpawnPoint = null;
    }

    async load(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load level: ${response.statusText}`);
        }
        const data = await response.json();
        this.spawnPoint = data.spawnPoint;
        this.deathSpawnPoint = data.deathSpawnPoint;
        return data;
    }

    getSpawnPoint() {
        return this.spawnPoint || { x: 0, y: 10, z: 0 };
    }

    getDeathSpawnPoint() {
        return this.deathSpawnPoint;
    }

    build(levelData) {
        // Skybox and Fog
        this.scene.background = new THREE.Color(parseInt(levelData.settings.backgroundColor || "0x000000", 16));
        this.scene.fog = new THREE.Fog(parseInt(levelData.settings.fogColor, 16), levelData.settings.fogNear, levelData.settings.fogFar);
        
        // Clean old lights
        this.scene.children.filter(c => c.isLight).forEach(l => this.scene.remove(l));
        
        // Ambient
        const ambientLight = new THREE.AmbientLight(parseInt(levelData.settings.ambientLight.color, 16), levelData.settings.ambientLight.intensity);
        this.scene.add(ambientLight);
        
        // Directional Lights
        const directionalLights = [];
        // Ensure directionalLights array exists on settings for new levels
        if (!levelData.settings.directionalLights) {
            levelData.settings.directionalLights = [];
        }
        const lightDefs = levelData.settings.directionalLights;

        // Backwards compatibility for old single-light format
        if (levelData.settings.directionalLight && lightDefs.length === 0) {
            lightDefs.push(levelData.settings.directionalLight);
        }

        lightDefs.forEach(lightData => {
            const light = this.createDirectionalLight(lightData);
            directionalLights.push(light);
        });

        const levelObjects = [];
        const enemies = [];

        levelData.objects.forEach(objData => {
            const obj = this.createObject(objData);
            levelObjects.push(obj);
        });

        if (levelData.enemies) {
            levelData.enemies.forEach(enemyData => {
                const enemy = this.createEnemy(enemyData);
                enemies.push(enemy);
            });
        }
        
        // Return triggers to be handled by the TutorialManager
        return { levelObjects, enemies, ambientLight, directionalLights, triggers: levelData.triggers, deathTriggers: levelData.deathTriggers };
    }

    createDirectionalLight(lightData) {
        const light = new THREE.DirectionalLight(parseInt(lightData.color, 16), lightData.intensity);
        light.position.set(lightData.position.x, lightData.position.y, lightData.position.z);
        
        if (lightData.targetPosition) {
            light.target.position.set(lightData.targetPosition.x, lightData.targetPosition.y, lightData.targetPosition.z);
        }
        this.scene.add(light.target); // Add target to scene for matrix updates
        
        light.castShadow = true;
        light.userData.definition = lightData; 
        this.scene.add(light);
        return light;
    }

    createObject(objData) {
        let mesh, body, shape;
        const mat = new THREE.MeshStandardMaterial({
            color: objData.material ? parseInt(objData.material.color, 16) : 0xcccccc,
            roughness: (objData.material && objData.material.roughness) || 0.8
        });

        const size = objData.size || [1, 1, 1];

        if (objData.type === 'Plane') {
            mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
            shape = new CANNON.Plane();
        } else { // Default to Box
            mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
            const halfExtents = new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2);
            shape = new CANNON.Box(halfExtents);
        }
        
        const mass = (objData.physics && objData.physics.mass) || 0;
        body = new CANNON.Body({
            type: mass > 0 ? CANNON.Body.DYNAMIC : CANNON.Body.STATIC,
            mass: mass,
            shape: shape,
            collisionFilterGroup: COLLISION_GROUPS.WORLD
        });
        
        const position = objData.position || {x:0, y:5, z:0};
        mesh.position.set(position.x, position.y, position.z);
        body.position.copy(mesh.position);
        
        if (objData.rotation) {
            mesh.rotation.set(
                THREE.MathUtils.degToRad(objData.rotation.x || 0),
                THREE.MathUtils.degToRad(objData.rotation.y || 0),
                THREE.MathUtils.degToRad(objData.rotation.z || 0)
            );
            body.quaternion.copy(mesh.quaternion);
        }
        
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        this.scene.add(mesh);
        this.world.addBody(body);

        const levelObject = { mesh, body, definition: objData };
        levelObject.userData = { gameEntity: { type: 'Object', entity: levelObject } };
        mesh.userData.gameEntity = levelObject.userData.gameEntity;
        
        return levelObject;
    }

    createEnemy(enemyData) {
        const enemy = new Enemy({ game: this.game, name: enemyData.name || 'Dummy' });
        enemy.spawn(enemyData.position);
        
        enemy.definition = enemyData; // Definition attached directly to the instance
        enemy.userData = { gameEntity: { type: 'Enemy', entity: enemy } };
        enemy.mesh.userData.gameEntity = enemy.userData.gameEntity;
        return enemy;
    }
}