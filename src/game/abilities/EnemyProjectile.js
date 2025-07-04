// src/game/abilities/EnemyProjectile.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';
import { GAME_CONFIG } from '../../shared/config.js';
import { PhysicsBodyComponent } from '../components/PhysicsBodyComponent.js';

/**
 * A generic projectile fired by an NPC (enemy or ally).
 * It is a simple physics object that deals damage on impact to opposing teams.
 * The collision group and mask are set dynamically based on the caster's team.
 */
export class EnemyProjectile {
    constructor({ world, caster, initialVelocity }) {
        this.id = THREE.MathUtils.generateUUID();
        this.type = 'enemy_projectile'; // Kept for VFX system compatibility
        this.world = world;
        this.caster = caster;

        const config = GAME_CONFIG.NPC.RANGED;
        this.damage = config.PROJECTILE_DAMAGE;
        this.lifetime = 3.0;
        this.isDead = false;

        // Physics
        const shape = new CANNON.Sphere(0.2);
        
        // Dynamically set collision group and mask based on the caster's team.
        const isFriendlyCaster = caster.team === 'player';
        const group = isFriendlyCaster ? COLLISION_GROUPS.PLAYER_PROJECTILE : COLLISION_GROUPS.ENEMY_PROJECTILE;
        const mask = isFriendlyCaster
            ? (COLLISION_GROUPS.WORLD | COLLISION_GROUPS.ENEMY)
            : (COLLISION_GROUPS.WORLD | COLLISION_GROUPS.PLAYER | COLLISION_GROUPS.ALLY);

        const body = new CANNON.Body({
            mass: 0.1,
            shape,
            collisionFilterGroup: group,
            collisionFilterMask: mask,
        });

        const spawnDirection = new CANNON.Vec3().copy(initialVelocity);
        spawnDirection.normalize();
        const spawnPos = new CANNON.Vec3().copy(caster.physics.body.position);
        const offset = spawnDirection.scale(2);
        spawnPos.vadd(offset, spawnPos);
        
        body.position.copy(spawnPos);
        body.velocity.copy(initialVelocity);
        
        this.physics = new PhysicsBodyComponent(body);
        
        if (!body.userData) body.userData = {};
        body.userData.entity = this;

        body.addEventListener('collide', (e) => this.onCollide(e));
        
        this.world.physics.addBody(body);
        this.world.add(this);
    }

    onCollide(event) {
        if (this.isDead) return;

        const targetEntity = event.body?.userData?.entity;

        // A projectile should damage any entity on an opposing team.
        if (targetEntity?.team && targetEntity.team !== this.caster.team) {
            if (typeof targetEntity.takeDamage === 'function') {
                targetEntity.takeDamage(this.damage);
            }
        }
        
        // Detonate on impact with anything except a non-physical trigger volume.
        if (!(event.body.collisionFilterGroup & COLLISION_GROUPS.TRIGGER)) {
            this.world.remove(this);
        }
    }

    update(deltaTime) {
        if (this.isDead) return;

        this.lifetime -= deltaTime;
        if (this.lifetime <= 0) {
            this.world.remove(this);
        }
    }
    
    dispose() {
        if (this.isDead) return;
        this.isDead = true;
        this.world.physics.queueForRemoval(this.physics.body);
    }
}