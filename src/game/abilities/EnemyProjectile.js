import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { COLLISION_GROUPS } from '../../common/CollisionGroups.js';

/**
 * A projectile fired by an enemy entity. It is given an initial velocity and is affected by gravity.
 */
export class EnemyProjectile {
    constructor({caster, initialVelocity}) {
        this.game = caster.game;
        this.scene = caster.scene;
        this.world = caster.world;
        
        // --- Configuration ---
        this.damage = 100;
        this.lifetime = 3.0;
        this.isDead = false;

        // --- Visuals ---
        const geometry = new THREE.SphereGeometry(0.2, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 10 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.light = new THREE.PointLight(0x00ffff, 200, 20, 2);
        this.mesh.add(this.light);

        // --- Physics ---
        const shape = new CANNON.Sphere(0.2);
        this.body = new CANNON.Body({
            mass: 0.1,
            shape,
            collisionFilterGroup: COLLISION_GROUPS.PROJECTILE,
            collisionFilterMask: COLLISION_GROUPS.WORLD | COLLISION_GROUPS.PLAYER,
            type: CANNON.Body.DYNAMIC,
            linearDamping: 0,
            angularDamping: 0,
        });

        // --- Trajectory ---
        // Spawn slightly in front of the caster.
        const spawnDirection = new CANNON.Vec3().copy(initialVelocity);
        spawnDirection.normalize(); // This modifies the vector in-place. Do not chain it.
        
        const spawnPos = new CANNON.Vec3().copy(caster.body.position);
        
        // Create the offset vector and add it to the spawn position.
        const offset = spawnDirection.scale(2);
        spawnPos.vadd(offset, spawnPos);
        
        this.body.position.copy(spawnPos);
        
        // Use the pre-calculated velocity from the enemy AI.
        this.body.velocity.copy(initialVelocity);
        
        this.body.addEventListener('collide', (event) => this.onCollide(event));

        // --- Finalize ---
        this.scene.add(this.mesh);
        this.world.addBody(this.body);
        this.game.updatables.push(this);
    }

    onCollide(event) {
        if (event.body === this.game.player.body) {
            this.game.player.takeDamage(this.damage);
        }
        this.cleanup();
    }

    update(deltaTime) {
        if (this.isDead) return;

        this.lifetime -= deltaTime;
        if (this.lifetime <= 0) {
            this.cleanup();
            return;
        }
        this.mesh.position.copy(this.body.position);
    }
    
    cleanup() {
        if (this.isDead) return;
        this.isDead = true;
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.game.physics.queueForRemoval(this.body);
        const updatableIndex = this.game.updatables.indexOf(this);
        if (updatableIndex > -1) {
            this.game.updatables.splice(updatableIndex, 1);
        }
    }
}