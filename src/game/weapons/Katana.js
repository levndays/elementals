// src/game/weapons/Katana.js
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
        this.swingDuration = 0.4; // Total animation duration
        this.hitTiming = 100; // Damage applied after 100ms (during main slash)
        
        // --- PERFORMANCE & Animation State: Reusable objects ---
        this._hitCheckPos = new THREE.Vector3();
        this._enemyPos = new THREE.Vector3();
        this._forward = new THREE.Vector3();

        // --- Define Keyframes for the Swing Animation ---
// (All positions relative to camera, rotations are local Euler angles for simplicity then converted to Quaternion)

// Idle pose (katana held at ready position, slightly to the side)
this.idlePosition = new THREE.Vector3(0.3, -0.2, -0.7); 
this.idleRotation = new THREE.Euler(
    THREE.MathUtils.degToRad(0),    // Level
    THREE.MathUtils.degToRad(15),   // Slightly angled right
    THREE.MathUtils.degToRad(90),   // Horizontal blade
    'YXZ'
);

// Wind-up pose (katana pulled back to the right, ready for horizontal slice)
this.windUpPosition = new THREE.Vector3(0.8, -0.2, -0.5); 
this.windUpRotation = new THREE.Euler(
    THREE.MathUtils.degToRad(0),    // Keep level
    THREE.MathUtils.degToRad(45),   // Pulled to the right
    THREE.MathUtils.degToRad(90),   // Maintain horizontal blade
    'YXZ'
);

// Slash midpoint/peak (blade slicing through center horizontally)
this.slashPeakPosition = new THREE.Vector3(0.0, -0.2, -0.8); 
this.slashPeakRotation = new THREE.Euler(
    THREE.MathUtils.degToRad(0),    // Perfectly level
    THREE.MathUtils.degToRad(0),    // Dead center
    THREE.MathUtils.degToRad(90),   // Perfect horizontal slice
    'YXZ'
);

// Follow-through pose (blade continues the slice to the left)
this.followThroughPosition = new THREE.Vector3(-0.8, -0.2, -0.5); 
this.followThroughRotation = new THREE.Euler(
    THREE.MathUtils.degToRad(0),    // Stay level
    THREE.MathUtils.degToRad(-45),  // Swept to the left
    THREE.MathUtils.degToRad(90),   // Keep horizontal blade
    'YXZ'
);

        // Pre-calculate quaternions for smooth interpolation
        this.qIdle = new THREE.Quaternion().setFromEuler(this.idleRotation);
        this.qWindUp = new THREE.Quaternion().setFromEuler(this.windUpRotation);
        this.qSlashPeak = new THREE.Quaternion().setFromEuler(this.slashPeakRotation);
        this.qFollowThrough = new THREE.Quaternion().setFromEuler(this.followThroughRotation);

        this.createMesh();
        // Set initial state
        this.mesh.position.copy(this.idlePosition);
        this.mesh.quaternion.copy(this.qIdle);
    }

    createMesh() {
        this.mesh = new THREE.Group();

        // Katana dimensions reference:
        // Blade length (Nagasa): ~70-80cm (let's use 0.7 units for the blade, hilt around 0.25-0.3)
        // Total length ~1 meter
        
        // Define common offset for the pivot point (where the player's hand holds the sword)
        // Let's assume the origin of the group is at the guard's center.
        // Hilt will extend down from here, blade will extend up.
        const bladeHeight = 0.7; // length of the blade
        const hiltHeight = 0.25; // length of the hilt
        const guardThickness = 0.02;

        // Blade material - metallic and slightly rough
        const bladeMat = new THREE.MeshStandardMaterial({ 
            color: 0xc0c0c0, // Light grey for steel
            metalness: 0.9, 
            roughness: 0.3 
        });
        const bladeGeom = new THREE.BoxGeometry(0.02, bladeHeight, 0.01); // Thinner, taller blade
        const blade = new THREE.Mesh(bladeGeom, bladeMat);
        blade.position.y = bladeHeight / 2 + guardThickness / 2; // Position above the guard
        blade.castShadow = true;
        blade.receiveShadow = true;

        // Guard (Tsuba) material - dark and less reflective
        const guardMat = new THREE.MeshStandardMaterial({ 
            color: 0x333333, // Dark grey
            metalness: 0.6, 
            roughness: 0.5 
        });
        const guardGeom = new THREE.BoxGeometry(0.06, guardThickness, 0.15); // Flat and wide
        const guard = new THREE.Mesh(guardGeom, guardMat);
        guard.position.y = 0; // At the group's pivot point
        guard.castShadow = true;
        guard.receiveShadow = true;

        // Hilt (Tsuka) material - dark and rough
        const hiltMat = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a, // Very dark grey
            roughness: 0.8 
        });
        const hiltGeom = new THREE.CylinderGeometry(0.025, 0.02, hiltHeight, 8); // Thin cylinder for handle
        const hilt = new THREE.Mesh(hiltGeom, hiltMat);
        hilt.position.y = -hiltHeight / 2 - guardThickness / 2; // Below the guard
        hilt.castShadow = true;
        hilt.receiveShadow = true;
        
        this.mesh.add(blade, guard, hilt);
    }

    attack() {
        if (!this.canAttack() || this.isSwinging) return false;

        this.isSwinging = true;
        this.swingProgress = 0;
        this.triggerCooldown();

        // Damage calculation happens slightly after the start of the "slash" phase
        // This timing should align with the fastest part of the blade's movement.
        setTimeout(() => {
            if (this.isSwinging) { // Ensure swing hasn't finished already
                this.detectHit();
            }
        }, this.hitTiming);

        return true;
    }

    update(deltaTime) {
        super.update(deltaTime); // Update cooldown timer

        if (this.isSwinging) {
            this.swingProgress += deltaTime;
            const totalProgress = Math.min(this.swingProgress / this.swingDuration, 1.0);

            // Define timing for each animation phase (as percentages of totalDuration)
            const windUpPhaseEnd = 0.15; // 0% - 15% : Wind-up
            const slashPhaseEnd = 0.65;  // 15% - 65% : Main Slash (50% of duration)
            // const recoveryPhaseEnd = 1.0; // 65% - 100% : Recovery (35% of duration)

            let currentPosition = new THREE.Vector3();
            let currentQuaternion = new THREE.Quaternion();
            let phaseProgress;

            if (totalProgress < windUpPhaseEnd) {
                // Phase 1: Wind-up (Idle -> WindUp)
                phaseProgress = totalProgress / windUpPhaseEnd;
                // Use a cubic ease-out for wind-up to feel responsive
                const easedProgress = phaseProgress * phaseProgress * (3 - 2 * phaseProgress);
                currentPosition.lerpVectors(this.idlePosition, this.windUpPosition, easedProgress);
                currentQuaternion.copy(this.qIdle).slerp(this.qWindUp, easedProgress);

            } else if (totalProgress < slashPhaseEnd) {
                // Phase 2: Main Slash (WindUp -> SlashPeak -> FollowThrough)
                const slashRelativeProgress = (totalProgress - windUpPhaseEnd) / (slashPhaseEnd - windUpPhaseEnd);
                
                // For position, we can use a simple quadratic curve or define intermediate points
                // Let's make it go through slashPeak at midpoint of this phase.
                const midpoint = 0.5; // relative to this phase
                if (slashRelativeProgress < midpoint) {
                    phaseProgress = slashRelativeProgress / midpoint; // 0 to 1 over first half
                    const easedProgress = phaseProgress * phaseProgress * (3 - 2 * phaseProgress); // Cubic ease out
                    currentPosition.lerpVectors(this.windUpPosition, this.slashPeakPosition, easedProgress);
                    currentQuaternion.copy(this.qWindUp).slerp(this.qSlashPeak, easedProgress);
                } else {
                    phaseProgress = (slashRelativeProgress - midpoint) / (1 - midpoint); // 0 to 1 over second half
                    const easedProgress = phaseProgress * phaseProgress * (3 - 2 * phaseProgress); // Cubic ease out
                    currentPosition.lerpVectors(this.slashPeakPosition, this.followThroughPosition, easedProgress);
                    currentQuaternion.copy(this.qSlashPeak).slerp(this.qFollowThrough, easedProgress);
                }

            } else {
                // Phase 3: Recovery (FollowThrough -> Idle)
                phaseProgress = (totalProgress - slashPhaseEnd) / (1.0 - slashPhaseEnd);
                // Use a quadratic ease-in for a smoother settle back
                const easedProgress = phaseProgress * phaseProgress;
                currentPosition.lerpVectors(this.followThroughPosition, this.idlePosition, easedProgress);
                currentQuaternion.copy(this.qFollowThrough).slerp(this.qIdle, easedProgress);
            }

            this.mesh.position.copy(currentPosition);
            this.mesh.quaternion.copy(currentQuaternion);

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
                }
            }
        }
    }
}