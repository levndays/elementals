import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';
import { PhysicsBodyComponent } from '../components/PhysicsBodyComponent.js';

/**
 * The Firefly homing projectile entity. Handles its own steering and collision logic.
 */
export class FireflyProjectile {
    constructor({ world, caster, target }) {
        this.id = THREE.MathUtils.generateUUID();
        this.type = 'firefly_projectile';
        this.world = world;
        this.caster = caster;
        this.target = target;
        
        this.damage = 100;
        this.lifetime = 6.0;
        this.speed = 18;
        this.isDead = false;
        this.homingForce = 4.0;
        
        const shape = new CANNON.Sphere(0.15);
        const body = new CANNON.Body({
            mass: 0.05, shape,
            collisionFilterGroup: COLLISION_GROUPS.PROJECTILE,
            collisionFilterMask: COLLISION_GROUPS.WORLD | COLLISION_GROUPS.ENEMY,
            linearDamping: 0.1,
        });
        body.allowSleep = false;
        
        const initialDirection = new THREE.Vector3();
        caster.camera.getWorldDirection(initialDirection);
        const initialPosition = new THREE.Vector3();
        caster.camera.getWorldPosition(initialPosition).add(initialDirection.clone().multiplyScalar(0.7));
        body.position.copy(initialPosition);
        body.velocity.copy(initialDirection.multiplyScalar(this.speed));

        if (!body.userData) body.userData = {};
        body.userData.entity = this;

        this.physics = new PhysicsBodyComponent(body);

        body.addEventListener('collide', (e) => this.detonate());
        
        this.preStepHandler = () => { 
            if (this.physics.body) {
                const antiGravity = new CANNON.Vec3(0, -this.world.physics.world.gravity.y, 0).scale(this.physics.body.mass);
                this.physics.body.applyForce(antiGravity, this.physics.body.position);
            }
        };
        this.world.physics.world.addEventListener('preStep', this.preStepHandler);

        this.world.physics.addBody(body);
        this.world.add(this);
    }

    update(deltaTime) {
        if (this.isDead) return;

        this.lifetime -= deltaTime;
        if (this.lifetime <= 0) {
            this.detonate();
            return;
        }
        
        this.applySteering();
        this.orientToVelocity(deltaTime);
    }
    
    orientToVelocity(deltaTime) {
        const body = this.physics.body;
        if (body.velocity.lengthSquared() > 0.1) {
            const lookAtTarget = new CANNON.Vec3();
            body.position.vadd(body.velocity, lookAtTarget);
            
            const tempObject3D = new THREE.Object3D();
            tempObject3D.position.copy(body.position);
            tempObject3D.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z);
            
            body.quaternion.slerp(tempObject3D.quaternion, 15 * deltaTime, body.quaternion);
        }
    }

    applySteering() {
        if (!this.target || this.target.isDead || !this.target.physics?.body) return;

        const desiredVelocity = new CANNON.Vec3();
        this.target.physics.body.position.vsub(this.physics.body.position, desiredVelocity);

        if (desiredVelocity.lengthSquared() < 1) {
            this.detonate();
            return;
        }

        desiredVelocity.normalize();
        desiredVelocity.scale(this.speed, desiredVelocity);
        
        const steeringForce = new CANNON.Vec3();
        desiredVelocity.vsub(this.physics.body.velocity, steeringForce);
        steeringForce.normalize();
        steeringForce.scale(this.homingForce, steeringForce);
        
        this.physics.body.applyForce(steeringForce, this.physics.body.position);
    }

    detonate() {
        if (this.isDead) return;

        this.world.emit('projectileDetonated', { type: 'Firefly', position: this.physics.body.position });
        
        const radiusSq = 4 * 4;
        for (const enemy of this.world.getEnemies()) {
            if (enemy.physics?.body && enemy.physics.body.position.distanceSquared(this.physics.body.position) < radiusSq) {
                enemy.takeDamage(this.damage);
            }
        }
        
        this.world.remove(this);
    }
    
    dispose() {
        if (this.isDead) return;
        this.isDead = true;
        this.world.physics.world.removeEventListener('preStep', this.preStepHandler);
        if (this.physics.body) this.world.physics.queueForRemoval(this.physics.body);
    }
}