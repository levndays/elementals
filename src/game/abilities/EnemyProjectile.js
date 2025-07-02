// src/game/abilities/EnemyProjectile.js

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';
import { GAME_CONFIG } from '../../shared/config.js';
import { PhysicsBodyComponent } from '../components/PhysicsBodyComponent.js';

/**
 * A projectile fired by an enemy entity. It is a simple physics object that deals damage on impact.
 */
export class EnemyProjectile {
    constructor({ world, caster, initialVelocity }) {
        this.id = THREE.MathUtils.generateUUID();
        this.type = 'enemy_projectile';
        this.world = world;
        this.caster = caster;

        const config = GAME_CONFIG.ENEMY.DUMMY;
        this.damage = config.PROJECTILE_DAMAGE;
        this.lifetime = 3.0;
        this.isDead = false;

        // Physics
        const shape = new CANNON.Sphere(0.2);
        const body = new CANNON.Body({
            mass: 0.1,
            shape,
            collisionFilterGroup: COLLISION_GROUPS.PROJECTILE,
            collisionFilterMask: COLLISION_GROUPS.WORLD | COLLISION_GROUPS.PLAYER,
        });

        const spawnDirection = new CANNON.Vec3().copy(initialVelocity);
        spawnDirection.normalize(); // This modifies the vector in-place.
        const spawnPos = new CANNON.Vec3().copy(caster.physics.body.position);
        const offset = spawnDirection.scale(2); // .scale() returns a new, scaled vector.
        spawnPos.vadd(offset, spawnPos);
        
        body.position.copy(spawnPos);
        body.velocity.copy(initialVelocity);
        
        this.physics = new PhysicsBodyComponent(body);
        
        // FIX: Ensure userData object exists before assignment
        if (!body.userData) body.userData = {};
        body.userData.entity = this; // Link back for collision detection

        body.addEventListener('collide', (e) => this.onCollide(e));
        
        this.world.physics.addBody(body);
        this.world.add(this);
    }

    onCollide(event) {
        if (this.isDead) return;
        const targetEntity = event.body?.userData?.entity;
        if (targetEntity?.type === 'player') {
            targetEntity.takeDamage(this.damage);
        }
        this.world.remove(this);
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