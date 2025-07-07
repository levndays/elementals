// ~ src/game/prefabs/NPCPrefab.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { NPC } from '../entities/NPC.js';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';
import { GAME_CONFIG } from '../../shared/config.js';
import { RENDERING_LAYERS } from '../../shared/CollisionGroups.js';

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

        // 1. Visuals (Mesh)
        const geometry = new THREE.CapsuleGeometry(0.7, 1.0, 4, 8);
        const color = team === 'enemy' ? 0x990000 : 0x009933; // Red for enemies, Green for allies
        const material = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: 0x000000 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.position.copy(definition.position);
        mesh.layers.enable(RENDERING_LAYERS.NO_REFLECTION);

        // 2. Physics (Body)
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
            shape,
            position: new CANNON.Vec3(definition.position.x, definition.position.y, definition.position.z),
            fixedRotation: true,
            collisionFilterGroup: group,
            collisionFilterMask: mask,
            linearDamping: 0.1,
        });

        // 3. Entity creation
        const entity = new NPC(world, body, mesh, definition);
        
        return entity;
    }
}