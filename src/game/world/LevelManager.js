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
        this.waterfallTextures = null; // Cache for waterfall textures
        this.cubeTextureLoader = new THREE.CubeTextureLoader();
    }

    async build(levelData) {
        this.world.levelName = levelData.name || 'Unnamed Level';
        this.world.spawnPoint.copy(levelData.spawnPoint);
        this.world.deathSpawnPoint.copy(levelData.deathSpawnPoint || levelData.spawnPoint);

        const sceneSetupResult = await this._setupScene(levelData.settings);
        
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

    async _setupScene(settings) {
        // Dispose previous background if it was a texture
        if (this.scene.background && this.scene.background.isTexture) {
            this.scene.background.dispose();
        }

        if (settings.skybox) {
            try {
                // Changed .jpg to .png
                const urls = ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'].map(file => settings.skybox + file);
                this.scene.background = await this.cubeTextureLoader.loadAsync(urls);
            } catch (error) {
                console.warn(`Could not load skybox from ${settings.skybox}. Defaulting to background color.`, error);
                this.scene.background = new THREE.Color(parseInt(settings.backgroundColor, 16));
            }
        } else {
            this.scene.background = new THREE.Color(parseInt(settings.backgroundColor, 16));
        }

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
    
    createProgrammaticTexture(drawFn, size = 256) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        drawFn(ctx, size);
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    getWaterfallTextures() {
        if (!this.waterfallTextures) {
            const flowTexture = this.createProgrammaticTexture((ctx, size) => {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, size, size);
                ctx.fillStyle = 'black';
                for (let i = 0; i < 1000; i++) {
                    const x = Math.random() * size;
                    const y = Math.random() * size;
                    const w = Math.random() * 2 + 1;
                    const h = Math.random() * 30 + 10;
                    ctx.globalAlpha = Math.random() * 0.5 + 0.2;
                    ctx.fillRect(x, y, w, h);
                }
            });

            const noiseTexture = this.createProgrammaticTexture((ctx, size) => {
                for (let i = 0; i < 10000; i++) {
                    const x = Math.random() * size;
                    const y = Math.random() * size;
                    const c = Math.floor(Math.random() * 128 + 128);
                    ctx.fillStyle = `rgb(${c},${c},${c})`;
                    ctx.fillRect(x, y, 2, 2);
                }
            });

            this.waterfallTextures = { flowTexture, noiseTexture };
        }
        return this.waterfallTextures;
    }

    createWaterfall(objData, size, body) {
        const { flowTexture, noiseTexture } = this.getWaterfallTextures();
        const waterfallMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uFlowTexture: { value: flowTexture },
                uNoiseTexture: { value: noiseTexture },
            },
            vertexShader: `varying vec2 vUv; varying vec3 vNormal; void main() { vUv = uv; vNormal = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `
                precision mediump float;
                uniform float uTime;
                uniform sampler2D uFlowTexture;
                uniform sampler2D uNoiseTexture;
                varying vec2 vUv;
                varying vec3 vNormal;

                void main() {
                    vec2 flowUv = vUv * vec2(1.0, 4.0) + vec2(0.0, -uTime * 0.4);
                    vec2 noiseUv = vUv * vec2(1.5, 2.0) + vec2(uTime * 0.05, -uTime * 0.15);
                    float noise = texture2D(uNoiseTexture, noiseUv).r;
                    vec2 distortedUv = flowUv + vec2(noise - 0.5, 0.0) * 0.1;
                    float distortedFlow = texture2D(uFlowTexture, distortedUv).r;
                    float edgeFade = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
                    float verticalFade = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.95, vUv.y);
                    float finalAlpha = distortedFlow * edgeFade * verticalFade;
                    vec3 waterColor = vec3(0.8, 0.9, 1.0);
                    float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
                    vec3 finalColor = waterColor + fresnel * 0.2;
                    if (finalAlpha < 0.1) discard;
                    gl_FragColor = vec4(finalColor, finalAlpha * 0.7);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const waterfallMesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), waterfallMaterial);
        
        const entity = { type: 'Water', mesh: waterfallMesh, body, definition: objData, isWaterfall: true };
        this.world.on('update', ({deltaTime, elapsedTime}) => {
            if (waterfallMesh.material.uniforms) {
                 waterfallMesh.material.uniforms.uTime.value = elapsedTime;
            }
        });
        return entity;
    }

    createWaterPool(objData, size) {
        let sunLight = this.world.scene.children.find(c => c.isDirectionalLight);
        if (!sunLight) {
            sunLight = new THREE.DirectionalLight(0xffffff, 1);
            sunLight.position.set(0, 100, 0);
        }

        const waterSunColor = new THREE.Color(sunLight.color).multiplyScalar(0.3);

        const water = new Water(new THREE.PlaneGeometry(size[0], size[2]), {
            textureWidth: 512, textureHeight: 512,
            waterNormals: new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }),
            sunDirection: sunLight.position.clone().normalize(),
            sunColor: waterSunColor, waterColor: 0x005577,
            distortionScale: 3.7, fog: !!this.world.scene.fog, alpha: 0.95,
        });
        
        water.rotation.x = -Math.PI / 2;
        const entity = { type: 'Water', mesh: water, isWaterfall: false, definition: objData };
        return entity;
    }

    createWater(objData) {
        const size = (objData.size || [1, 1, 1]).map(s => Math.abs(s) || 0.1);
        const position = new CANNON.Vec3(objData.position.x, objData.position.y, objData.position.z);
        const rotation = objData.rotation ? new THREE.Euler(
            THREE.MathUtils.degToRad(objData.rotation.x), 
            THREE.MathUtils.degToRad(objData.rotation.y), 
            THREE.MathUtils.degToRad(objData.rotation.z), 'YXZ') 
        : new THREE.Euler();
        
        const cannonQuat = new CANNON.Quaternion().setFromEuler(rotation.x, rotation.y, rotation.z);
        
        const shape = new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2));
        const body = new CANNON.Body({
            type: CANNON.Body.STATIC, isTrigger: true, shape, position, quaternion: cannonQuat,
            collisionFilterGroup: COLLISION_GROUPS.WATER,
            collisionFilterMask: COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.ENEMY | COLLISION_GROUPS.ALLY,
        });

        const threeQuat = new THREE.Quaternion(cannonQuat.x, cannonQuat.y, cannonQuat.z, cannonQuat.w);
        const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(threeQuat);
        const isVertical = Math.abs(upVector.y) < 0.5;

        let entity;
        if (isVertical) {
            entity = this.createWaterfall(objData, size, body);
        } else {
            const poolEntity = this.createWaterPool(objData, size);
            poolEntity.body = body;
            entity = poolEntity;
        }
        
        entity.mesh.position.copy(position);
        entity.mesh.quaternion.copy(threeQuat);
        
        if (!entity.isWaterfall) {
            entity.mesh.rotateX(-Math.PI / 2);
        }

        const helperMaterial = new THREE.MeshBasicMaterial({ color: 0x2288ee, transparent: true, opacity: 0.35, wireframe: true });
        const helperMesh = new THREE.Mesh(new THREE.BoxGeometry(...size), helperMaterial);
        helperMesh.position.copy(position);
        helperMesh.quaternion.copy(threeQuat);
        entity.helperMesh = helperMesh;
        
        const link = { type: 'Water', entity };
        entity.userData = { gameEntity: link };
        entity.mesh.userData.gameEntity = link;
        entity.helperMesh.userData.gameEntity = link;
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