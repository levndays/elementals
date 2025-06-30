// src/game/abilities/Fireball.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { ParticleExplosion } from './ParticleExplosion.js';
import { COLLISION_GROUPS } from '../../common/CollisionGroups.js';

export class Fireball {
    constructor(caster) {
        this.caster = caster;
        this.scene = caster.game.renderer.scene; // Use the main game scene
        this.game = caster.game;
        this.physics = caster.game.physics;
        this.world = this.physics.world;

        this.MAX_TRAVEL_DISTANCE = 70;
        this.SPEED = 35;
        this.LIFETIME = this.MAX_TRAVEL_DISTANCE / this.SPEED;
        this.RADIUS = 0.3;
        this.GROW_DURATION = 0.2;
        this.LINGER_DURATION = 3.0;
        this.SHRINK_DURATION = 0.5;
        this.FINAL_SCALE = 40;
        this.DAMAGE_PER_SECOND = 75;
        
        this.state = 'TRAVELING';
        this.stateTimer = 0;
        this.isDead = false; // Initialize isDead
        this.body = null;
        this.preStepHandler = this.applyAntiGravity.bind(this);

        // --- PERFORMANCE: Reusable objects for AOE checks ---
        this._aoeExplosionCenter = new THREE.Vector3();
        this._aoePlayerPosition = new THREE.Vector3();
        this._aoeEnemyPosition = new THREE.Vector3();

        const geometry = new THREE.SphereGeometry(this.RADIUS, 32, 32);
        const material = new THREE.MeshStandardMaterial({
            color: 0xff8800, emissive: 0xff4400, emissiveIntensity: 5,
            roughness: 0.6, metalness: 0.2,
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = false;
        this.mesh.castShadow = false;
        
        const camera = this.caster.camera;
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);

        const startPosition = new THREE.Vector3();
        camera.getWorldPosition(startPosition).add(cameraDirection.clone().multiplyScalar(1.5));
        
        // --- Physics Body ---
        const shape = new CANNON.Sphere(this.RADIUS);
        this.body = new CANNON.Body({
            mass: 0.5,
            shape,
            collisionFilterGroup: COLLISION_GROUPS.PROJECTILE,
            collisionFilterMask: COLLISION_GROUPS.WORLD | COLLISION_GROUPS.ENEMY,
            type: CANNON.Body.DYNAMIC,
            linearDamping: 0,
            angularDamping: 0,
        });

        this.body.position.copy(startPosition);
        this.body.velocity.copy(cameraDirection.multiplyScalar(this.SPEED));
        
        this.body.addEventListener('collide', (event) => {
            if (this.isDead) return; // Prevent multiple detonations or processing after already dead

            // Prevent explosion center from being inside a wall.
            // We find the contact normal and nudge the detonation point slightly away from the surface.
            const contactNormal = new CANNON.Vec3();
            
            // The contact normal (ni) points from the second body (bj) to the first (bi).
            // We need a normal that consistently points away from the surface we hit.
            if (event.contact.bi.id === this.body.id) {
                // If we are body 'i', the normal already points away from the other object.
                contactNormal.copy(event.contact.ni);
            } else {
                // If we are body 'j', we need to flip the normal.
                event.contact.ni.negate(contactNormal);
            }

            const hitPoint = new CANNON.Vec3().copy(this.body.position);
            // Nudge the explosion center 10cm away from the wall to ensure it's in open space.
            hitPoint.vadd(contactNormal.scale(0.1), hitPoint);

            this.detonate(hitPoint);
        });

        this.mesh.position.copy(this.body.position);

        this.light = new THREE.PointLight(0xffaa33, 500, 100, 2);
        this.light.castShadow = true;
        this.scene.add(this.mesh);
        this.scene.add(this.light);
        this.world.addBody(this.body);
        this.world.addEventListener('preStep', this.preStepHandler);
        this.game.updatables.push(this);
    }

    applyAntiGravity() {
        if (!this.body || this.isDead || this.state !== 'TRAVELING') return;
        const antiGravity = new CANNON.Vec3(0, -this.world.gravity.y, 0).scale(this.body.mass);
        this.body.applyForce(antiGravity, this.body.position);
    }

    get explosionRadius() {
        if (this.state === 'GROWING' || this.state === 'LINGERING' || this.state === 'SHRINKING') {
            return this.mesh.scale.x * this.RADIUS;
        }
        return 0;
    }

    detonate(hitPoint) {
        if (this.isDead) return; // Ensure it detonates only once
        
        this.state = 'GROWING';
        this.stateTimer = 0;
        this.isDead = true; // Mark as dead immediately upon detonation start
        
        this.mesh.position.copy(hitPoint);
        
        if (this.body) {
            this.physics.queueForRemoval(this.body);
            this.body = null; // Null the body reference immediately
        }
        this.world.removeEventListener('preStep', this.preStepHandler);
        
        this.game.activeEffects.push(this);
        new ParticleExplosion(this.scene, this.mesh.position, this.game.updatables);
    }

    update(deltaTime) {
        if (this.isDead && this.state !== 'GROWING' && this.state !== 'LINGERING' && this.state !== 'SHRINKING') return;

        this.stateTimer += deltaTime;

        if (this.mesh && this.light) { // Ensure mesh and light still exist for updates
            this.light.position.copy(this.mesh.position);
        }

        switch (this.state) {
            case 'TRAVELING':
                if (this.stateTimer > this.LIFETIME) {
                    this.detonate(this.body.position);
                    break;
                }
                if (this.body && this.mesh) { // Ensure body still exists for position update
                    this.mesh.position.copy(this.body.position);
                }
                break;
            case 'GROWING':
                this.handleGrowing();
                this.updateAoeDamage(deltaTime);
                break;
            case 'LINGERING':
                this.handleLingering();
                this.updateAoeDamage(deltaTime);
                break;
            case 'SHRINKING':
                this.handleShrinking();
                break;
        }
    }
    
    handleGrowing() {
        if (!this.mesh) return; // Ensure mesh exists
        let progress = Math.min(this.stateTimer / this.GROW_DURATION, 1.0);
        const scale = THREE.MathUtils.lerp(1, this.FINAL_SCALE, progress);
        this.mesh.scale.set(scale, scale, scale);
        this.mesh.material.emissiveIntensity = THREE.MathUtils.lerp(5, 10, progress);
        if (this.light) { // Ensure light exists
            this.light.intensity = THREE.MathUtils.lerp(500, 1000, progress);
        }

        if (progress >= 1.0) {
            this.mesh.scale.set(this.FINAL_SCALE, this.FINAL_SCALE, this.FINAL_SCALE);
            this.state = 'LINGERING';
            this.stateTimer = 0;
        }
    }

    updateAoeDamage(deltaTime) {
        if (!this.mesh) return; // Ensure mesh exists
        const explosionRadius = this.explosionRadius;
        if (explosionRadius <= 0) return;

        this._aoeExplosionCenter.copy(this.mesh.position);
        const damage = this.DAMAGE_PER_SECOND * deltaTime;

        const player = this.game.player;
        if (player && player.body) {
            this._aoePlayerPosition.copy(player.body.position);
            const playerRadius = player.body.shapes[0].radius;
            if (this._aoePlayerPosition.distanceTo(this._aoeExplosionCenter) < explosionRadius + playerRadius) {
                player.takeDamage(damage);
            }
        }

        for (const enemy of this.game.enemies) {
            if (enemy && enemy.body && !enemy.isDead) {
                this._aoeEnemyPosition.copy(enemy.body.position);
                const enemyRadius = enemy.body.shapes[0].radius;
                if (this._aoeEnemyPosition.distanceTo(this._aoeExplosionCenter) < explosionRadius + enemyRadius) {
                    enemy.takeDamage(damage);
                }
            }
        }
    }
    
    handleLingering() {
        if (!this.mesh || !this.light) return; // Ensure mesh and light exist
        const pulse = Math.sin(this.stateTimer * Math.PI * 2) * 0.5 + 0.5;
        this.mesh.material.emissiveIntensity = THREE.MathUtils.lerp(8, 12, pulse);
        this.light.intensity = THREE.MathUtils.lerp(20000, 25000, pulse);
        
        if (this.stateTimer >= this.LINGER_DURATION) {
            this.state = 'SHRINKING';
            this.stateTimer = 0;
        }
    }
    
    handleShrinking() {
        if (!this.mesh || !this.light) return; // Ensure mesh and light exist
        let progress = Math.min(this.stateTimer / this.SHRINK_DURATION, 1.0);
        const scale = THREE.MathUtils.lerp(this.FINAL_SCALE, 0, progress);
        this.mesh.scale.set(scale, scale, scale);
        
        this.light.intensity = THREE.MathUtils.lerp(1500, 0, progress);
        this.mesh.material.emissiveIntensity = THREE.MathUtils.lerp(12, 0, progress);
        if (progress >= 1.0) this.cleanup();
    }

    cleanup() {
        // This function is intended for final visual cleanup and removal from updatables/activeEffects.
        // The 'isDead' flag and body removal are handled by detonate().
        if (!this.mesh) return; // Already cleaned up

        this.scene.remove(this.mesh);
        if (this.light) this.scene.remove(this.light); // Light might already be nulled by detonate
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        
        this.mesh = null; // Null references to prevent accidental re-cleanup
        this.light = null;

        const effectIndex = this.game.activeEffects.indexOf(this);
        if (effectIndex > -1) this.game.activeEffects.splice(effectIndex, 1);
        const updatableIndex = this.game.updatables.indexOf(this);
        if (updatableIndex > -1) {
            this.game.updatables.splice(updatableIndex, 1);
        }
    }
}