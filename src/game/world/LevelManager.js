// ~ src/game/world/LevelManager.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { NPCPrefab } from '../prefabs/NPCPrefab.js';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';
import { Water } from 'three/addons/objects/Water.js';

export class LevelManager {
    constructor(world) {
        this.world = world;
        this.scene = world.scene;
    }

    build(levelData) {
        this.world.levelName = levelData.name || 'Unnamed Level';
        this.world.spawnPoint.copy(levelData.spawnPoint);
        this.world.deathSpawnPoint.copy(levelData.deathSpawnPoint || levelData.spawnPoint);

        const sceneSetupResult = this._setupScene(levelData.settings);
        
        (levelData.objects || []).map(d => this.createObject(d)).forEach(e => this.world.add(e));
        (levelData.npcs || []).map(d => this.createNPC(d)).forEach(e => this.world.add(e));
        (levelData.triggers || []).map(d => this.createTrigger(d, 'Trigger')).forEach(e => this.world.add(e));
        (levelData.deathTriggers || []).map(d => this.createTrigger(d, 'DeathTrigger')).forEach(e => this.world.add(e));

        if (this.world.initialEnemyCount !== undefined) {
            this.world.initialEnemyCount = this.world.getEnemies().length;
            this.world.enemiesKilled = 0;
        }

        return sceneSetupResult;
    }

    _setupScene(settings) {
        this.scene.background = new THREE.Color(parseInt(settings.backgroundColor, 16));
        this.scene.fog = new THREE.Fog(parseInt(settings.fogColor, 16), settings.fogNear, settings.fogFar);
        
        const existingLights = this.scene.children.filter(c => c.isLight);
        existingLights.forEach(l => {
            if(l.target) this.scene.remove(l.target);
            this.scene.remove(l);
        });

        const ambientLight = new THREE.AmbientLight(parseInt(settings.ambientLight.color, 16), settings.ambientLight.intensity);
        this.scene.add(ambientLight);

        (settings.directionalLights || []).forEach(lightData => {
            const light = this.createDirectionalLight(lightData);
            this.scene.add(light, light.target);
        });

        return { ambientLight };
    }
    
    createDirectionalLight(lightData) {
        const light = new THREE.DirectionalLight(parseInt(lightData.color, 16), lightData.intensity);
        light.position.set(lightData.position.x, lightData.position.y, lightData.position.z);
        if (lightData.targetPosition) light.target.position.set(lightData.targetPosition.x, lightData.targetPosition.y, lightData.targetPosition.z);
        light.castShadow = true;
        light.userData.definition = lightData;
        return light;
    }

    recreateEntity(definition) {
        switch(definition.type) {
            case 'Water':
            case 'Box':
            case 'Plane':
                return this.createObject(definition);
            case 'Dummy':
                return this.createNPC(definition);
            case 'Trigger':
                return this.createTrigger(definition, 'Trigger');
            case 'DeathTrigger':
                return this.createTrigger(definition, 'DeathTrigger');
            // Note: Lights are handled differently in editor and not recreated this way
            default:
                return null;
        }
    }
    
    createWater(objData) {
        const size = (objData.size || [1, 1, 1]).map(s => Math.abs(s) || 0.1);
        const waterGeometry = new THREE.PlaneGeometry(size[0], size[2]);

        let sunLight = this.world.scene.children.find(c => c.isDirectionalLight);
        if (!sunLight) {
            sunLight = new THREE.DirectionalLight(0xffffff, 1);
            sunLight.position.set(0, 100, 0);
        }

        // REWORK: Create a dedicated color for water's sun reflection to prevent blowout,
        // adjust water color, and set alpha for transparency.
        const waterSunColor = new THREE.Color(sunLight.color).multiplyScalar(0.3);

        const water = new Water(waterGeometry, {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', function (texture) {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            }),
            sunDirection: sunLight.position.clone().normalize(),
            sunColor: waterSunColor,
            waterColor: 0x005577,
            distortionScale: 3.7,
            fog: this.world.scene.fog !== undefined,
            alpha: 0.95
        });

        water.rotation.x = -Math.PI / 2;
        water.position.set(objData.position.x, objData.position.y + size[1] / 2, objData.position.z);
        
        const shape = new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2));
        const body = new CANNON.Body({
            type: CANNON.Body.STATIC, isTrigger: true, shape,
            position: new CANNON.Vec3(objData.position.x, objData.position.y, objData.position.z),
            collisionFilterGroup: COLLISION_GROUPS.WATER,
            collisionFilterMask: COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.ENEMY | COLLISION_GROUPS.ALLY,
        });

        const helperMaterial = new THREE.MeshBasicMaterial({ color: 0x2288ee, transparent: true, opacity: 0.35, wireframe: true });
        const helperMesh = new THREE.Mesh(new THREE.BoxGeometry(...size), helperMaterial);
        helperMesh.position.copy(body.position);
        helperMesh.quaternion.copy(body.quaternion);

        const entity = { type: 'Water', mesh: water, helperMesh, body, definition: objData };
        const link = { type: 'Water', entity };
        entity.userData = { gameEntity: link };
        water.userData.gameEntity = link;
        helperMesh.userData.gameEntity = link;

        if (!body.userData) body.userData = {};
        body.userData.entity = entity;
        
        return entity;
    }

    createObject(objData) {
        if (objData.type === 'Water') {
            return this.createWater(objData);
        }

        let mesh, body, shape;
        const mat = new THREE.MeshStandardMaterial({ color: parseInt(objData.material?.color, 16) || 0xcccccc, roughness: objData.material?.roughness ?? 0.8 });
        const size = (objData.size || [1,1,1]).map(s => Math.abs(s) || 0.1);

        if (objData.type === 'Plane') {
            mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
            shape = new CANNON.Plane();
        } else {
            mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
            shape = new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2));
        }
        
        body = new CANNON.Body({ mass: objData.physics?.mass ?? 0, shape, type: (objData.physics?.mass ?? 0) > 0 ? CANNON.Body.DYNAMIC : CANNON.Body.STATIC, collisionFilterGroup: COLLISION_GROUPS.WORLD });
        
        mesh.position.set(objData.position.x, objData.position.y, objData.position.z);
        if (objData.rotation) mesh.rotation.set(THREE.MathUtils.degToRad(objData.rotation.x || 0), THREE.MathUtils.degToRad(objData.rotation.y || 0), THREE.MathUtils.degToRad(objData.rotation.z || 0));
        
        body.position.copy(mesh.position);
        body.quaternion.copy(mesh.quaternion);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const entity = { type: 'Object', mesh, body, definition: objData };
        const link = { type: 'Object', entity };
        entity.userData = { gameEntity: link };
        mesh.userData.gameEntity = link;
        if (!body.userData) body.userData = {};
        body.userData.entity = entity;
        
        return entity;
    }

    createNPC(npcData) {
        return NPCPrefab.create(this.world, npcData);
    }

    createTrigger(triggerData, type) {
        const isDeathTrigger = type === 'DeathTrigger';
        const color = isDeathTrigger ? 0xff0000 : parseInt(triggerData.color || "0x00ff00", 16);
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, wireframe: true, depthWrite: false });
        
        const size = (triggerData.size || [1,1,1]).map(s => Math.abs(s) || 0.1);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
        mesh.position.set(triggerData.position.x, triggerData.position.y, triggerData.position.z);

        const shape = new CANNON.Box(new CANNON.Vec3(...size.map(s => s / 2)));
        const body = new CANNON.Body({ type: CANNON.Body.STATIC, isTrigger: true, shape, position: new CANNON.Vec3(triggerData.position.x, triggerData.position.y, triggerData.position.z), collisionFilterGroup: COLLISION_GROUPS.TRIGGER, collisionFilterMask: COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.ENEMY | COLLISION_GROUPS.ALLY });
        
        if (triggerData.rotation) {
            mesh.rotation.set(THREE.MathUtils.degToRad(triggerData.rotation.x || 0), THREE.MathUtils.degToRad(triggerData.rotation.y || 0), THREE.MathUtils.degToRad(triggerData.rotation.z || 0));
            body.quaternion.copy(mesh.quaternion);
        }
        
        const entityType = isDeathTrigger ? 'DeathTrigger' : 'Trigger';
        const entity = { type: entityType, mesh, body, definition: triggerData, message: triggerData.message, duration: triggerData.duration, hasFired: false };
        entity.userData = { gameEntity: { type: entityType, entity } };
        mesh.userData.gameEntity = entity.userData.gameEntity;
        if (!body.userData) body.userData = {};
        body.userData.entity = entity;
        
        return entity;
    }
}