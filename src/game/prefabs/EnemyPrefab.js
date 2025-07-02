// src/game/prefabs/EnemyPrefab.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Enemy } from '../entities/Enemy.js';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';
import { GAME_CONFIG } from '../../shared/config.js';

/**
 * A factory for creating enemy entities with all their required components.
 */
export class EnemyPrefab {

    /**
     * Creates a new enemy entity.
     * @param {import('../world/World.js').World} world - The world context.
     * @param {object} definition - The enemy definition from level data.
     * @returns {Enemy} The fully assembled enemy entity.
     */

    static create(world, definition) {
        const config = GAME_CONFIG.ENEMY.DUMMY;

        // 1. Visuals (Mesh)
        const geometry = new THREE.CapsuleGeometry(0.7, 1.0, 4, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x990000, roughness: 0.4, emissive: 0x000000 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.position.copy(definition.position);

        // 2. Physics (Body)
        const shape = new CANNON.Sphere(config.RADIUS);
        const body = new CANNON.Body({
            mass: config.MASS,
            shape,
            position: new CANNON.Vec3(definition.position.x, definition.position.y, definition.position.z),
            fixedRotation: true,
            collisionFilterGroup: COLLISION_GROUPS.ENEMY,
            collisionFilterMask: COLLISION_GROUPS.WORLD | COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.ENEMY | COLLISION_GROUPS.PROJECTILE | COLLISION_GROUPS.TRIGGER,
        });

        // 3. Entity creation
        const entity = new Enemy(world, body, mesh, definition);
        
        return entity;
    }
}