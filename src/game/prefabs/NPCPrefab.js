// src/game/prefabs/NPCPrefab.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { NPC } from '../entities/NPC.js';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';
import { GAME_CONFIG } from '../../shared/config.js';
import { RENDERING_LAYERS } from '../../shared/CollisionGroups.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/**
 * A factory for creating NPC entities with all their required components.
 */
export class NPCPrefab {
    /**
     * Creates a new NPC entity.
     * @param {import('../world/World.js').World} world - The world context.
     * @param {object} definition - The NPC definition from level data.
     * @returns {NPC} The fully assembled NPC entity.
     */
    static create(world, definition) {
        const config = GAME_CONFIG.NPC.BASE;
        const team = definition.team || 'enemy';

        // 1. Visuals (Mesh) - Clone from pre-loaded asset
        const originalGltf = world.core.assets.get('npcMannequin');
        
        const containerGroup = new THREE.Group();
        const modelMesh = SkeletonUtils.clone(originalGltf.scene);
        modelMesh.rotation.y = Math.PI;
        containerGroup.add(modelMesh);
        containerGroup.scale.setScalar(0.9);
        
        const teamColor = team === 'enemy' ? new THREE.Color(0x990000) : new THREE.Color(0x009933);
        containerGroup.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.layers.enable(RENDERING_LAYERS.NO_REFLECTION);
                child.material = child.material.clone();
                child.material.color.lerp(teamColor, 0.4);
            }
        });
        
        containerGroup.position.copy(definition.position);

        // 2. Physics (Body) - Use a Sphere for live state.
        const shape = new CANNON.Sphere(config.RADIUS);
        
        let group, mask;
        if (team === 'enemy') {
            group = COLLISION_GROUPS.ENEMY;
            mask = COLLISION_GROUPS.WORLD | COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.ALLY | COLLISION_GROUPS.PLAYER_PROJECTILE | COLLISION_GROUPS.TRIGGER | COLLISION_GROUPS.WATER;
        } else { // ally
            group = COLLISION_GROUPS.ALLY;
            mask = COLLISION_GROUPS.WORLD | COLLISION_GROUPS.ENEMY | COLLISION_GROUPS.ENEMY_PROJECTILE | COLLISION_GROUPS.TRIGGER | COLLISION_GROUPS.WATER;
        }
        
        const body = new CANNON.Body({
            mass: config.MASS,
            position: new CANNON.Vec3(definition.position.x, definition.position.y, definition.position.z),
            fixedRotation: true,
            collisionFilterGroup: group,
            collisionFilterMask: mask,
            linearDamping: 0.1,
        });
        body.addShape(shape, new CANNON.Vec3(0, config.RADIUS, 0));

        // 3. Entity creation
        const entity = new NPC(world, body, containerGroup, definition);

        // 4. Animation Setup
        entity.mixer = new THREE.AnimationMixer(modelMesh);
        originalGltf.animations.forEach(clip => entity.animations.set(clip.name, clip));
        const idleAction = entity.mixer.clipAction(entity.animations.get('Idle'));
        idleAction.play();
        entity.activeAction = idleAction;

        // 5. Create Ragdoll Physics Skeleton
        this._createRagdoll(entity);
        
        return entity;
    }

    static _createRagdoll(entity) {
        const bones = {};
        entity.mesh.traverse(child => {
            if (child.isBone) bones[child.name] = child;
        });

        const massPerBody = entity.physics.body.mass / Object.keys(bones).length;
        const box = (w, h, d) => new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2));

        const bodyDefs = {
            'Hips': { shape: box(0.28, 0.22, 0.2), mass: massPerBody * 4 },
            'Spine': { shape: box(0.25, 0.25, 0.25), mass: massPerBody * 4 },
            'Head': { shape: new CANNON.Sphere(0.12), mass: massPerBody * 2 },
            'LeftArm': { shape: box(0.1, 0.4, 0.1), mass: massPerBody },
            'RightArm': { shape: box(0.1, 0.4, 0.1), mass: massPerBody },
            'LeftForeArm': { shape: box(0.08, 0.4, 0.08), mass: massPerBody },
            'RightForeArm': { shape: box(0.08, 0.4, 0.08), mass: massPerBody },
            'LeftUpLeg': { shape: box(0.15, 0.5, 0.15), mass: massPerBody * 2 },
            'RightUpLeg': { shape: box(0.15, 0.5, 0.15), mass: massPerBody * 2 },
            'LeftLeg': { shape: box(0.12, 0.5, 0.12), mass: massPerBody * 2 },
            'RightLeg': { shape: box(0.12, 0.5, 0.12), mass: massPerBody * 2 },
        };
        
        for (const name in bodyDefs) {
            const bone = bones[name];
            if (!bone) continue;

            const body = new CANNON.Body({ mass: bodyDefs[name].mass, shape: bodyDefs[name].shape });
            entity.ragdoll.bodies.push(body);
            entity.ragdoll.bodyBoneMap.set(body, bone);
        }

        const addConstraint = (bone1, bone2, pivot1, pivot2) => {
            const body1 = entity.ragdoll.bodyBoneMap.get(bones[bone1]);
            const body2 = entity.ragdoll.bodyBoneMap.get(bones[bone2]);
            if (body1 && body2) {
                const c = new CANNON.PointToPointConstraint(body1, new CANNON.Vec3(...pivot1), body2, new CANNON.Vec3(...pivot2));
                entity.ragdoll.constraints.push(c);
            }
        };

        // Connect joints
        addConstraint('Spine', 'Hips', [0, -0.125, 0], [0, 0.11, 0]);
        addConstraint('Spine', 'Head', [0, 0.125, 0], [0, -0.12, 0]);
        addConstraint('Spine', 'LeftArm', [-0.125, 0, 0], [0, 0.2, 0]);
        addConstraint('Spine', 'RightArm', [0.125, 0, 0], [0, 0.2, 0]);
        addConstraint('LeftArm', 'LeftForeArm', [0, -0.2, 0], [0, 0.2, 0]);
        addConstraint('RightArm', 'RightForeArm', [0, -0.2, 0], [0, 0.2, 0]);
        addConstraint('Hips', 'LeftUpLeg', [-0.1, -0.11, 0], [0, 0.25, 0]);
        addConstraint('Hips', 'RightUpLeg', [0.1, -0.11, 0], [0, 0.25, 0]);
        addConstraint('LeftUpLeg', 'LeftLeg', [0, -0.25, 0], [0, 0.25, 0]);
        addConstraint('RightUpLeg', 'RightLeg', [0, -0.25, 0], [0, 0.25, 0]);
    }
}