// src/game/world/LevelManager.js

 import * as THREE from 'three';
    import * as CANNON from 'cannon-es';
    import { NPCPrefab } from '../prefabs/NPCPrefab.js';
    import { COLLISION_GROUPS, RENDERING_LAYERS } from '../../shared/CollisionGroups.js';
    import { Water } from 'three/addons/objects/Water.js';
    
    export class LevelManager {
        constructor(world) {
            this.world = world;
            this.scene = world.scene;
            this.waterfallTextures = null; // Cache for waterfall textures
            this.cubeTextureLoader = new THREE.CubeTextureLoader();
            this.waterfallShaders = null;
        }
    
        async init() {
            if (this.waterfallShaders) return;
            const [vertexShader, fragmentShader] = await Promise.all([
                fetch('./src/client/rendering/shaders/waterfall.vert').then(res => res.text()),
                fetch('./src/client/rendering/shaders/waterfall.frag').then(res => res.text())
            ]);
            this.waterfallShaders = { vertexShader, fragmentShader };
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
                this.world.initialEnemyCount = this.world.getNPCs().filter(n => n.team === 'enemy').length;
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
                    // Defensively ensure the path has a trailing slash.
                    const path = settings.skybox.endsWith('/') ? settings.skybox : `${settings.skybox}/`;
                    const urls = ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'].map(file => path + file);
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
    
            const directionalLights = (settings.directionalLights || []).map(lightData => 
                this.createDirectionalLight(lightData)
            );
    
            return { ambientLight, directionalLights };
        }
        
        createDirectionalLight(lightData) {
            const light = new THREE.DirectionalLight(parseInt(lightData.color, 16), lightData.intensity);
            light.position.set(lightData.position.x, lightData.position.y, lightData.position.z);
            if (lightData.targetPosition) light.target.position.set(lightData.targetPosition.x, lightData.targetPosition.y, lightData.targetPosition.z);
            light.castShadow = true;
            light.shadow.camera.layers.enable(RENDERING_LAYERS.NO_REFLECTION);
            light.userData.definition = lightData;
            return light;
        }
    
        recreateEntity(definition) {
            switch(definition.type) {
                case 'Water':
                case 'Waterfall':
                case 'Box':
                case 'Plane':
                    return this.createObject(definition);
                case 'Dummy':
                    return this.createNPC(definition);
                case 'Trigger':
                    return this.createTrigger(definition, 'Trigger');
                case 'DeathTrigger':
                    return this.createTrigger(definition, 'DeathTrigger');
                case 'DirectionalLight': {
                    const light = this.createDirectionalLight(definition);
                    return this.world.createDirectionalLightWithHelper(light);
                }
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
    
        createWaterfall(objData) {
            if (!this.waterfallShaders) {
                console.error("Waterfall shaders have not been pre-loaded. LevelManager.init() must be called.");
                const fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0x00A3FF, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
                const fallbackMesh = new THREE.Mesh(new THREE.PlaneGeometry(objData.size[0], objData.size[1]), fallbackMaterial);
                return { type: 'Waterfall', mesh: fallbackMesh, definition: objData };
            }
    
            const { flowTexture, noiseTexture } = this.getWaterfallTextures();
            const waterfallMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: 0 },
                    uFlowTexture: { value: flowTexture },
                    uNoiseTexture: { value: noiseTexture },
                },
                vertexShader: this.waterfallShaders.vertexShader,
                fragmentShader: this.waterfallShaders.fragmentShader,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false
            });
    
            const waterfallMesh = new THREE.Mesh(new THREE.PlaneGeometry(objData.size[0], objData.size[1]), waterfallMaterial);
            
            const entity = { id: THREE.MathUtils.generateUUID(), type: 'Waterfall', mesh: waterfallMesh, definition: objData };
    
            entity.mesh.position.set(objData.position.x, objData.position.y, objData.position.z);
            if (objData.quaternion) {
                entity.mesh.quaternion.set(objData.quaternion.x, objData.quaternion.y, objData.quaternion.z, objData.quaternion.w);
            } else if (objData.rotation) {
                const euler = new THREE.Euler(THREE.MathUtils.degToRad(objData.rotation.x || 0), THREE.MathUtils.degToRad(objData.rotation.y || 0), THREE.MathUtils.degToRad(objData.rotation.z || 0), 'YXZ');
                entity.mesh.quaternion.setFromEuler(euler);
            }
    
            entity.mesh.castShadow = false;
            entity.mesh.receiveShadow = false;
            entity.mesh.layers.enable(RENDERING_LAYERS.NO_REFLECTION);
            
            const link = { type: 'Waterfall', entity };
            entity.userData = { gameEntity: link };
            entity.mesh.userData.gameEntity = link;
            
            return entity;
        }
    
        createWater(objData) {
            const size = (objData.size || [1, 1, 1]).map(s => Math.abs(s) || 0.1);
            const position = new CANNON.Vec3(objData.position.x, objData.position.y, objData.position.z);
            
            const cannonQuat = new CANNON.Quaternion();
            if (objData.quaternion) {
                cannonQuat.set(objData.quaternion.x, objData.quaternion.y, objData.quaternion.z, objData.quaternion.w);
            } else if (objData.rotation) {
                const euler = new THREE.Euler(THREE.MathUtils.degToRad(objData.rotation.x), THREE.MathUtils.degToRad(objData.rotation.y), THREE.MathUtils.degToRad(objData.rotation.z), 'YXZ');
                cannonQuat.setFromEuler(euler.x, euler.y, euler.z, euler.order);
            }
            
            const shape = new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2));
            const body = new CANNON.Body({
                type: CANNON.Body.STATIC, isTrigger: true, shape, position, quaternion: cannonQuat,
                collisionFilterGroup: COLLISION_GROUPS.WATER,
                collisionFilterMask: COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.ENEMY | COLLISION_GROUPS.ALLY,
            });
    
            let sunLight = this.world.scene.children.find(c => c.isDirectionalLight);
            if (!sunLight) {
                sunLight = new THREE.DirectionalLight(0xffffff, 1);
                sunLight.position.set(0, 100, 0);
            }
            const waterSunColor = new THREE.Color(sunLight.color).multiplyScalar(0.3);
    
            const waterMesh = new Water(new THREE.PlaneGeometry(size[0], size[2]), {
                // OPTIMIZATION: Lowered texture resolution for reflections/refractions
                textureWidth: 256, 
                textureHeight: 256,
                waterNormals: new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }),
                sunDirection: sunLight.position.clone().normalize(),
                sunColor: waterSunColor, 
                waterColor: 0x005577,
                // OPTIMIZATION: Reduced distortion scale to look better with lower res textures
                distortionScale: 2.0, 
                fog: !!this.world.scene.fog, 
                alpha: 0.9,
            });
            
            waterMesh.layers.disable(RENDERING_LAYERS.NO_REFLECTION);
    
            const entity = { id: THREE.MathUtils.generateUUID(), type: 'Water', mesh: waterMesh, body, definition: objData };
            
            // --- POSITIONING FIX ---
            // Calculate the world-space "up" vector of the rotated volume
            const upVector = new THREE.Vector3(0, 1, 0);
            upVector.applyQuaternion(new THREE.Quaternion().copy(cannonQuat));
    
            // The water surface should be at the center of the volume, offset by half the height along the volume's up direction.
            const waterSurfacePosition = new THREE.Vector3().copy(position).add(upVector.multiplyScalar(size[1] / 2));
            entity.mesh.position.copy(waterSurfacePosition);
            
            // Apply the volume's rotation, then rotate the plane to be horizontal relative to the volume
            entity.mesh.quaternion.copy(cannonQuat);
            entity.mesh.rotateX(-Math.PI / 2);
    
            const helperMaterial = new THREE.MeshBasicMaterial({ color: 0x2288ee, transparent: true, opacity: 0.35, wireframe: true });
            const helperMesh = new THREE.Mesh(new THREE.BoxGeometry(...size), helperMaterial);
            helperMesh.position.copy(position);
            helperMesh.quaternion.copy(cannonQuat);
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
            if (objData.type === 'Waterfall') {
                return this.createWaterfall(objData);
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
            
            // --- ИСПРАВЛЕННАЯ ЛОГИКА ---
            mesh.position.set(objData.position.x, objData.position.y, objData.position.z);

            if (objData.quaternion) {
                mesh.quaternion.set(
                    objData.quaternion.x,
                    objData.quaternion.y,
                    objData.quaternion.z,
                    objData.quaternion.w
                );
            } else if (objData.rotation) { // Fallback for old levels
                const euler = new THREE.Euler(
                    THREE.MathUtils.degToRad(objData.rotation.x || 0),
                    THREE.MathUtils.degToRad(objData.rotation.y || 0),
                    THREE.MathUtils.degToRad(objData.rotation.z || 0),
                    'YXZ'
                );
                mesh.quaternion.setFromEuler(euler);
            }

            // ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ: Копируем трансформацию из mesh в body
            body.position.copy(mesh.position);
            body.quaternion.copy(mesh.quaternion);
            // --- КОНЕЦ ИСПРАВЛЕННОЙ ЛОГИКИ ---

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
            
            if (triggerData.quaternion) {
                body.quaternion.set(triggerData.quaternion.x, triggerData.quaternion.y, triggerData.quaternion.z, triggerData.quaternion.w);
            } else if (triggerData.rotation) {
                const euler = new THREE.Euler(THREE.MathUtils.degToRad(triggerData.rotation.x || 0), THREE.MathUtils.degToRad(triggerData.rotation.y || 0), THREE.MathUtils.degToRad(triggerData.rotation.z || 0), 'YXZ');
                body.quaternion.setFromEuler(euler.x, euler.y, euler.z, euler.order);
            }
            mesh.quaternion.copy(body.quaternion);
            
            const entityType = isDeathTrigger ? 'DeathTrigger' : 'Trigger';
            const entity = { type: entityType, mesh, body, definition: triggerData, message: triggerData.message, duration: triggerData.duration, hasFired: false };
            entity.userData = { gameEntity: { type: entityType, entity } };
            mesh.userData.gameEntity = entity.userData.gameEntity;
            if (!body.userData) body.userData = {};
            body.userData.entity = entity;
            
            return entity;
        }
    }