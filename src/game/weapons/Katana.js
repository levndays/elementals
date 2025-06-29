import * as THREE from 'three';
import { Weapon } from './Weapon.js';

export class Katana extends Weapon {
    constructor(wielder) {
        super(wielder, {
            name: 'Katana',
            damage: 250,
            cooldown: 0.6,
        });

        // --- Melee Parameters ---
        this.swingRange = 4.0;
        
        // --- Animation Parameters ---
        this.isSwinging = false;
        this.swingProgress = 0;
        this.swingDuration = 0.4; // A bit longer for a more complex animation
        // Damage is applied ~100ms into the animation, during the fastest part of the slash
        this.hitTiming = 100;
        
        // --- PERFORMANCE & Animation State: Reusable objects ---
        this._hitCheckPos = new THREE.Vector3();
        this._enemyPos = new THREE.Vector3();
        this._forward = new THREE.Vector3();

        // --- Define Keyframes for the Swing Animation ---
        // Idle pose (default)
        this.idlePosition = new THREE.Vector3(0.4, -0.4, -0.8);
        this.idleRotation = new THREE.Euler(0, -Math.PI / 12, Math.PI / 24, 'YXZ');
        
        // Start of the swing (wind-up pose, bottom-right)
        this.swingStartPosition = new THREE.Vector3(0.6, -0.6, -0.5);
        this.swingStartRotation = new THREE.Euler(Math.PI / 8, Math.PI / 3, -Math.PI / 6, 'YXZ');

        // End of the swing (follow-through pose, top-left)
        this.swingEndPosition = new THREE.Vector3(-0.4, -0.1, -0.6);
        this.swingEndRotation = new THREE.Euler(-Math.PI / 6, -Math.PI / 2, Math.PI / 4, 'YXZ');

        // Pre-calculate quaternions to avoid re-creation in the update loop
        this.qIdle = new THREE.Quaternion().setFromEuler(this.idleRotation);
        this.qSwingStart = new THREE.Quaternion().setFromEuler(this.swingStartRotation);
        this.qSwingEnd = new THREE.Quaternion().setFromEuler(this.swingEndRotation);

        this.createMesh();
        // Set initial state
        this.mesh.position.copy(this.idlePosition);
        this.mesh.quaternion.copy(this.qIdle);
    }

    createMesh() {
        this.mesh = new THREE.Group();

        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.9, roughness: 0.3 });
        const bladeGeom = new THREE.BoxGeometry(0.04, 0.9, 0.01); 
        const blade = new THREE.Mesh(bladeGeom, bladeMat);
        blade.position.y = 0.45;
        blade.castShadow = true;

        const guardMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.5 });
        const guardGeom = new THREE.BoxGeometry(0.06, 0.02, 0.15);
        const guard = new THREE.Mesh(guardGeom, guardMat);
        guard.position.y = 0;
        guard.castShadow = true;

        const hiltMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
        const hiltGeom = new THREE.CylinderGeometry(0.025, 0.02, 0.25, 8);
        const hilt = new THREE.Mesh(hiltGeom, hiltMat);
        hilt.position.y = -0.125;
        hilt.castShadow = true;
        
        this.mesh.add(blade, guard, hilt);
    }

    attack() {
        if (!this.canAttack() || this.isSwinging) return false;

        this.isSwinging = true;
        this.swingProgress = 0;
        this.triggerCooldown();

        setTimeout(() => {
            this.detectHit();
        }, this.hitTiming);

        return true;
    }

    update(deltaTime) {
        super.update(deltaTime); // Update cooldown timer

        if (this.isSwinging) {
            this.swingProgress += deltaTime;
            const totalProgress = Math.min(this.swingProgress / this.swingDuration, 1.0);

            // Define animation phases by their end points (e.g., wind-up ends at 15% of total duration)
            const windUpEnd = 0.15;
            const slashEnd = 0.50; // Wind-up (0.15) + Slash (0.35)

            let phaseProgress;

            if (totalProgress < windUpEnd) {
                // Phase 1: Wind-up (Idle -> Start)
                phaseProgress = totalProgress / windUpEnd;
                // Ease-out makes the wind-up start fast and settle into the pose
                const easeProgress = 1 - Math.pow(1 - phaseProgress, 2);
                this.mesh.position.lerpVectors(this.idlePosition, this.swingStartPosition, easeProgress);
                this.mesh.quaternion.copy(this.qIdle).slerp(this.qSwingStart, easeProgress);

            } else if (totalProgress < slashEnd) {
                // Phase 2: Slash (Start -> End)
                phaseProgress = (totalProgress - windUpEnd) / (slashEnd - windUpEnd);
                // Ease-out quart makes for a very fast, snappy slash
                const easeProgress = 1 - Math.pow(1 - phaseProgress, 4);
                this.mesh.position.lerpVectors(this.swingStartPosition, this.swingEndPosition, easeProgress);
                this.mesh.quaternion.copy(this.qSwingStart).slerp(this.qSwingEnd, easeProgress);

            } else {
                // Phase 3: Recovery (End -> Idle)
                phaseProgress = (totalProgress - slashEnd) / (1.0 - slashEnd);
                // Ease-in makes the recovery smooth
                const easeProgress = phaseProgress * phaseProgress;
                this.mesh.position.lerpVectors(this.swingEndPosition, this.idlePosition, easeProgress);
                this.mesh.quaternion.copy(this.qSwingEnd).slerp(this.qIdle, easeProgress);
            }

            if (totalProgress >= 1.0) {
                this.isSwinging = false;
                this.mesh.position.copy(this.idlePosition);
                this.mesh.quaternion.copy(this.qIdle);
            }
        }
    }

    detectHit() {
        const camera = this.wielder.camera;
        camera.getWorldDirection(this._forward);
        
        const playerPos = this.wielder.body.position;

        for (const enemy of this.wielder.game.enemies) {
            if (enemy.isDead || !enemy.body) continue;

            this._enemyPos.copy(enemy.body.position);
            const distance = playerPos.distanceTo(this._enemyPos);

            if (distance < this.swingRange + enemy.body.shapes[0].radius) {
                const toEnemy = this._enemyPos.clone().sub(playerPos).normalize();
                const dot = this._forward.dot(toEnemy);
                
                // cos(50 degrees) ~= 0.64, a generous frontal cone for the swing
                if (dot > 0.64) { 
                    enemy.takeDamage(this.damage);
                    // To prevent hitting multiple enemies with one swing, we break.
                    // Remove this for a cleave effect.
                    break;
                }
            }
        }
    }
}