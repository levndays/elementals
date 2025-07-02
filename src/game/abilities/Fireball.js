// src/game/abilities/Fireball.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';

/**
 * The Fireball projectile entity. Handles its own movement, collision, and area-of-effect logic.
 * Emits an event for the client to create the visual explosion.
 */
export class Fireball {
    constructor({ world, caster, spawnPosition }) {
        this.world = world;
        this.physics = world.physics;
        this.id = Math.random();

        this.LIFETIME = 2.0;
        this.SPEED = 35;
        this.RADIUS = 0.3;
        this.LINGER_DURATION = 3.0;
        this.DAMAGE_PER_SECOND = 75;
        
        this.state = 'TRAVELING';
        this.stateTimer = 0;
        this.isDead = false;

        const shape = new CANNON.Sphere(this.RADIUS);
        this.body = new CANNON.Body({
            mass: 0.5, shape,
            collisionFilterGroup: COLLISION_GROUPS.PROJECTILE,
            collisionFilterMask: COLLISION_GROUPS.WORLD | COLLISION_GROUPS.ENEMY,
        });

        // Use the safe spawn position passed from the ability
        this.body.position.copy(spawnPosition);

        // Still need caster's direction for velocity
        const threeCameraDirection = new THREE.Vector3();
        caster.camera.getWorldDirection(threeCameraDirection);
        const cannonVelocity = new CANNON.Vec3().copy(threeCameraDirection).scale(this.SPEED);
        this.body.velocity.copy(cannonVelocity);
        
        this.onCollideHandler = (e) => {
            if (this.body) {
                this.detonate(this.body.position.clone());
            }
        };
        this.body.addEventListener('collide', this.onCollideHandler);

        this.preStepHandler = () => {
            if (this.state === 'TRAVELING' && this.body) {
                const antiGravity = new CANNON.Vec3(0, -this.physics.world.gravity.y, 0).scale(this.body.mass);
                this.body.applyForce(antiGravity, this.body.position);
            }
        };
        this.physics.world.addEventListener('preStep', this.preStepHandler);

        this.aoeSphere = new CANNON.Sphere(this.RADIUS * 40);
        this.aoeBody = new CANNON.Body({ type: CANNON.Body.STATIC, isTrigger: true });
        this.aoeBody.addShape(this.aoeSphere);

        this.physics.addBody(this.body);
        this.world.add(this);
    }

    detonate(position) {
        if (this.state !== 'TRAVELING') return;

        this.state = 'LINGERING';
        this.stateTimer = 0;
        
        if (this.body) {
            this.body.removeEventListener('collide', this.onCollideHandler);
            this.physics.queueForRemoval(this.body);
            this.body = null;
        }
        
        this.aoeBody.position.copy(position);
        this.physics.addBody(this.aoeBody);

        this.world.emit('projectileDetonated', { type: 'Fireball', position });
    }

    update(deltaTime) {
        if (this.isDead) return;

        this.stateTimer += deltaTime;

        if (this.state === 'TRAVELING') {
            if (this.stateTimer > this.LIFETIME && this.body) {
                this.detonate(this.body.position.clone());
            }
        } else if (this.state === 'LINGERING') {
            this.updateAoeDamage(deltaTime);
            if (this.stateTimer > this.LINGER_DURATION) {
                this.world.remove(this);
            }
        }
    }

    updateAoeDamage(deltaTime) {
        const damage = this.DAMAGE_PER_SECOND * deltaTime;
        const radiusSq = this.aoeSphere.radius * this.aoeSphere.radius;

        // Check player
        if (this.world.player.physics.body.position.distanceSquared(this.aoeBody.position) < radiusSq) {
            this.world.player.takeDamage(damage);
        }
        // Check enemies
        for (const enemy of this.world.getEnemies()) {
            if (enemy.physics.body.position.distanceSquared(this.aoeBody.position) < radiusSq) {
                enemy.takeDamage(damage);
            }
        }
    }
    
    dispose() {
        if (this.isDead) return;
        this.isDead = true;
        this.physics.world.removeEventListener('preStep', this.preStepHandler);
        if (this.body) {
            this.body.removeEventListener('collide', this.onCollideHandler);
            this.physics.queueForRemoval(this.body);
        }
        if (this.aoeBody) this.physics.queueForRemoval(this.aoeBody);
    }
}