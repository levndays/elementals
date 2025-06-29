import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { COLLISION_GROUPS } from '../../common/CollisionGroups.js';
import { ParticleExplosion } from './ParticleExplosion.js';

export class FireflyProjectile {
    constructor({ caster, target }) {
        this.caster = caster;
        this.target = target;
        this.game = caster.game;
        this.scene = caster.game.renderer.scene; // Use the main game scene
        this.world = caster.world;

        // --- Configuration ---
        this.damage = 100;
        this.lifetime = 5.0;
        this.speed = 18;
        this.homingStrength = 2.5;
        this.isDead = false;
        this.state = 'HOMING'; // State machine: 'HOMING', 'EXPLODING'
        this.preStepHandler = this.applyAntiGravity.bind(this);

        // --- Explosion parameters ---
        this.explosionRadius = 2.5;
        this.explosionDamageRadius = 3.5;
        this.explosionDuration = 0.5;
        this.explosionTimer = 0;
        
        // --- PERFORMANCE: Reusable objects for AOE and Homing ---
        this._aoeExplosionCenter = new THREE.Vector3();
        this._aoeEnemyPosition = new THREE.Vector3();
        this._homingTargetBasePos = new CANNON.Vec3();
        this._homingEffectiveTargetPos = new CANNON.Vec3();
        this._homingDirectionToTarget = new CANNON.Vec3();
        this._homingDesiredVelocity = new CANNON.Vec3();
        this._homingSteeringForce = new CANNON.Vec3();

        // --- Trajectory variation parameters ---
        this.wobblePhase = Math.random() * Math.PI * 2;
        this.wobbleAmplitude = 0.5;
        this.wobbleFrequency = 8;
        this.targetPointOffset = new CANNON.Vec3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 1,
            (Math.random() - 0.5) * 2
        ).scale(1.5);

        // --- Visuals (Three.js Mesh and Light) ---
        const geometry = new THREE.SphereGeometry(0.15, 8, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffa500,
            emissive: 0xffa500,
            emissiveIntensity: 5,
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = false;
        this.light = new THREE.PointLight(0xffa500, 150, 10, 2);
        this.mesh.add(this.light);

        // --- Physics (Cannon.js Body) ---
        const shape = new CANNON.Sphere(0.15);
        this.body = new CANNON.Body({
            mass: 0.05,
            shape,
            collisionFilterGroup: COLLISION_GROUPS.PROJECTILE,
            collisionFilterMask: COLLISION_GROUPS.WORLD | COLLISION_GROUPS.ENEMY,
            type: CANNON.Body.DYNAMIC,
            linearDamping: 0,
            angularDamping: 0,
        });
        this.body.allowSleep = false;
        
        const playerCamera = this.caster.camera;
        const initialDirection = new THREE.Vector3();
        playerCamera.getWorldDirection(initialDirection);
        const coneSpreadAngle = THREE.MathUtils.degToRad(15);
        const randomAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        const randomQuaternion = new THREE.Quaternion().setFromAxisAngle(randomAxis, (Math.random() - 0.5) * 2 * coneSpreadAngle);
        initialDirection.applyQuaternion(randomQuaternion);
        const initialPosition = new THREE.Vector3();
        playerCamera.getWorldPosition(initialPosition).add(initialDirection.clone().multiplyScalar(0.7));
        this.body.position.copy(initialPosition);
        
        const initialVelocity = new CANNON.Vec3().copy(initialDirection).scale(this.speed);
        this.body.velocity.copy(initialVelocity);

        this.body.addEventListener('collide', (event) => this.onCollide(event));

        this.scene.add(this.mesh);
        this.world.addBody(this.body);
        this.world.addEventListener('preStep', this.preStepHandler);
        this.game.updatables.push(this);
    }

    applyAntiGravity() {
        if (!this.body || this.isDead || this.state !== 'HOMING') return;
        const antiGravity = new CANNON.Vec3(0, -this.world.gravity.y, 0).scale(this.body.mass);
        this.body.applyForce(antiGravity, this.body.position);
    }

    onCollide(event) {
        if (this.state !== 'HOMING') return;
        this.detonate();
    }

    update(deltaTime) {
        if (this.isDead) return;

        switch (this.state) {
            case 'HOMING':
                this.lifetime -= deltaTime;
                if (this.lifetime <= 0) {
                    this.detonate();
                    return;
                }
                this.wobblePhase += deltaTime * this.wobbleFrequency;
                if (this.target && this.target.body && !this.target.isDead) {
                    this._homingTargetBasePos.copy(this.target.body.position);
                    this._homingTargetBasePos.vadd(this.targetPointOffset, this._homingEffectiveTargetPos);

                    const currentWobbleX = Math.sin(this.wobblePhase) * this.wobbleAmplitude;
                    const currentWobbleZ = Math.cos(this.wobblePhase) * this.wobbleAmplitude;
                    this._homingEffectiveTargetPos.x += currentWobbleX;
                    this._homingEffectiveTargetPos.z += currentWobbleZ;

                    const distanceToEffectiveTarget = this.body.position.distanceTo(this._homingEffectiveTargetPos);
                    if (distanceToEffectiveTarget <= this.explosionRadius) {
                        this.detonate();
                        return;
                    }
                    
                    this._homingEffectiveTargetPos.vsub(this.body.position, this._homingDirectionToTarget);
                    this._homingDirectionToTarget.normalize();
                    this._homingDirectionToTarget.scale(this.speed, this._homingDesiredVelocity);

                    this._homingDesiredVelocity.vsub(this.body.velocity, this._homingSteeringForce);
                    this._homingSteeringForce.scale(this.homingStrength * deltaTime, this._homingSteeringForce);
                    this.body.velocity.vadd(this._homingSteeringForce, this.body.velocity);

                    if (this.body.velocity.length() > this.speed) {
                        this.body.velocity.normalize();
                        this.body.velocity.scale(this.speed, this.body.velocity);
                    }
                }
                this.mesh.position.copy(this.body.position);
                this.mesh.quaternion.copy(this.body.quaternion);
                break;

            case 'EXPLODING':
                this.explosionTimer += deltaTime;
                this.light.intensity = THREE.MathUtils.lerp(150, 0, this.explosionTimer / this.explosionDuration);
                if (this.explosionTimer >= this.explosionDuration) {
                    this.cleanup();
                }
                break;
        }
    }

    detonate() {
        if (this.state !== 'HOMING') return;
        
        this.state = 'EXPLODING';
        this.explosionTimer = 0;

        this.game.physics.queueForRemoval(this.body);
        new ParticleExplosion(this.scene, this.mesh.position, this.game.updatables);
        this.applyAoEDamage(this.mesh.position, this.explosionDamageRadius, this.damage);
        this.mesh.visible = false;
    }

    applyAoEDamage(explosionCenter, radius, damageAmount) {
        this._aoeExplosionCenter.copy(explosionCenter);
        for (const enemy of [...this.game.enemies]) { 
            if (enemy && enemy.body && !enemy.isDead) {
                this._aoeEnemyPosition.copy(enemy.body.position);
                const enemyRadius = enemy.body.shapes[0].radius;
                if (this._aoeEnemyPosition.distanceTo(this._aoeExplosionCenter) < radius + enemyRadius) {
                    enemy.takeDamage(damageAmount);
                }
            }
        }
    }

    cleanup() {
        if (this.isDead) return;
        this.isDead = true;

        this.world.removeEventListener('preStep', this.preStepHandler);

        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();

        const updatableIndex = this.game.updatables.indexOf(this);
        if (updatableIndex > -1) {
            this.game.updatables.splice(updatableIndex, 1);
        }
    }
}