// ~ src/game/weapons/Sai.js
import * as THREE from 'three';
import { Weapon } from './Weapon.js';
import { GAME_CONFIG } from '../../shared/config.js';
import { BleedingEffect } from '../effects/BleedingEffect.js'; // Import BleedingEffect

export class Sai extends Weapon {
    constructor() {
        super(null, {
            name: 'Twin Sai',
            damage: GAME_CONFIG.SAI.DAMAGE,
            cooldown: GAME_CONFIG.SAI.COOLDOWN,
        });

        this.swingRange = GAME_CONFIG.SAI.RANGE;
        
        this.state = 'idle'; // idle, swinging, inspecting
        this.animationProgress = 0;
        this.animationDuration = 0;

        // Internal helpers
        this._forward = new THREE.Vector3();
        this._npcPos = new THREE.Vector3();
        
        this._defineKeyframes();
        this.createMesh(); // Creates this.mesh, this.leftSai, this.rightSai
        
        this.mesh.position.copy(this.idlePosition);
        this.mesh.quaternion.copy(this.qIdle);
    }

    _defineKeyframes() {
        // Sai Group Base position and rotation
        // Adjusted to be further forward and slightly more centered.
        this.idlePosition = new THREE.Vector3(0.0, -0.4, -0.8);
        this.qIdle = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, 0, 0)); // Slight downward tilt

        // Individual Sai offsets within the group (these will be animated)
        // More spaced apart horizontally and slightly forward.
        this.leftSaiIdlePos = new THREE.Vector3(-0.35, -0.05, 0.05);
        this.rightSaiIdlePos = new THREE.Vector3(0.35, -0.05, 0.05);

        // --- Swing Animation ---
        this.swingDuration = 0.4;
        this.hitTiming = 100; // ms (when hit detection occurs)

        // Attack keyframes (for individual Sais, relative to group)
        // Wind-up: Sais draw back and turn slightly.
        this.leftSaiWindUpRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0.4, 0.1));
        this.rightSaiWindUpRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, -0.4, -0.1));

        // Impact: Sais thrust forward, rotating to meet the target.
        this.leftSaiImpactRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, -0.2, 0.0)); // Less Z rotation, more focused
        this.rightSaiImpactRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0.2, 0.0)); // Less Z rotation, more focused

        // --- Inspect Animation ---
        this.inspectDuration = 3.0;
        this.inspectUpPos = new THREE.Vector3(0, -0.2, -0.6);
        this.qInspectUp = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0, 0));

        this.leftSaiInspectRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI * 0.5, 0, 0));
        this.rightSaiInspectRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI * 0.5, 0, 0));
    }

    createMesh() {
        this.mesh = new THREE.Group(); // Parent group for both Sais

        const metalMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9, roughness: 0.2 });
        const gripMat = new THREE.MeshStandardMaterial({ color: 0xAA0000, roughness: 0.9 }); // Red fabric look

        const createSingleSai = () => {
            const saiGroup = new THREE.Group();
            
            // Main Blade (longer and thinner box, positioned with its base at 0,0,0)
            const bladeGeo = new THREE.BoxGeometry(0.015, 0.4, 0.015);
            const blade = new THREE.Mesh(bladeGeo, metalMat);
            blade.position.y = 0.2; // Half its height to sit on the crossguard

            // Yoku (Crossguard) - central block
            const guardBaseGeo = new THREE.BoxGeometry(0.06, 0.02, 0.02); // Width, height, depth
            const guardBase = new THREE.Mesh(guardBaseGeo, metalMat);
            guardBase.position.y = 0; // At the junction of blade and hilt

            // Prongs (Yoku) - more realistic curved shape
            const prongRadius = 0.01;
            const prongCurvature = 0.05; // controls how much it curves outward
            const prongLength = 0.12;

            // Right Prong
            const rightProngGroup = new THREE.Group();
            const rProngMain = new THREE.Mesh(
                new THREE.CylinderGeometry(prongRadius, prongRadius, prongLength, 8),
                metalMat
            );
            rProngMain.position.set(prongLength / 2, 0, 0);
            rProngMain.rotation.z = Math.PI / 2;
            rightProngGroup.add(rProngMain);

            const rProngTip = new THREE.Mesh(
                new THREE.CylinderGeometry(prongRadius, prongRadius, prongLength * 0.5, 8),
                metalMat
            );
            rProngTip.position.set(prongLength * 0.8, prongCurvature, 0); // Position relative to main prong
            rProngTip.rotation.z = Math.PI / 2;
            rProngTip.rotation.y = Math.PI / 4; // Angle it slightly
            rightProngGroup.add(rProngTip);

            rightProngGroup.position.set(guardBase.geometry.parameters.width / 2, 0.01, 0); // Attach to right side of guardBase
            saiGroup.add(rightProngGroup);

            // Left Prong (mirrored)
            const leftProngGroup = new THREE.Group();
            const lProngMain = new THREE.Mesh(
                new THREE.CylinderGeometry(prongRadius, prongRadius, prongLength, 8),
                metalMat
            );
            lProngMain.position.set(-prongLength / 2, 0, 0);
            lProngMain.rotation.z = Math.PI / 2;
            leftProngGroup.add(lProngMain);

            const lProngTip = new THREE.Mesh(
                new THREE.CylinderGeometry(prongRadius, prongRadius, prongLength * 0.5, 8),
                metalMat
            );
            lProngTip.position.set(-prongLength * 0.8, prongCurvature, 0);
            lProngTip.rotation.z = Math.PI / 2;
            lProngTip.rotation.y = -Math.PI / 4; // Angle it slightly
            leftProngGroup.add(lProngTip);

            leftProngGroup.position.set(-guardBase.geometry.parameters.width / 2, 0.01, 0); // Attach to left side of guardBase
            saiGroup.add(leftProngGroup);
            
            // Hilt (wrapped handle)
            const hiltGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.15, 8);
            const hilt = new THREE.Mesh(hiltGeo, gripMat);
            hilt.position.y = -0.075; // Half of its height

            // Pommel (metal cap at the end of the hilt)
            const pommelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.01, 8);
            const pommel = new THREE.Mesh(pommelGeo, metalMat);
            pommel.position.y = -0.15;

            saiGroup.add(blade, guardBase, hilt, pommel);
            saiGroup.scale.setScalar(1.0); 
            saiGroup.castShadow = true;
            return saiGroup;
        };

        this.leftSai = createSingleSai();
        this.rightSai = createSingleSai();

        // Initial positions within the parent group
        this.leftSai.position.copy(this.leftSaiIdlePos);
        this.rightSai.position.copy(this.rightSaiIdlePos);

        this.mesh.add(this.leftSai, this.rightSai);
    }

    attack() {
        if (!this.canAttack() || this.state !== 'idle') return false;
        
        this.state = 'swinging';
        this.animationDuration = this.swingDuration;
        this.animationProgress = 0;
        this.triggerCooldown();
        setTimeout(() => { if (this.state === 'swinging') this.detectHit(); }, this.hitTiming);
        return true;
    }

    inspect() {
        // Only allow inspect from idle state and if not in water
        if (this.state !== 'idle' || this.wielder.isInWater) return;
        this.state = 'inspecting';
        this.animationDuration = this.inspectDuration;
        this.animationProgress = 0;
    }

    detectHit() {
        if (!this.wielder) return;

        this.wielder.camera.getWorldDirection(this._forward);
        const playerPos = this.wielder.physics.body.position;

        for (const npc of this.wielder.world.getEnemies()) {
            if (npc.isDead || !npc.physics.body) continue;

            this._npcPos.copy(npc.physics.body.position);
            const distance = playerPos.distanceTo(this._npcPos);

            if (distance < this.swingRange + npc.physics.body.shapes[0].radius) {
                const toNPC = this._npcPos.clone().sub(playerPos).normalize();
                if (this._forward.dot(toNPC) > 0.64) { // Roughly in a 50-degree cone in front
                    let damage = this.damage;
                    if (this.wielder.statusEffects.has('stonePlating')) {
                        const effect = this.wielder.statusEffects.get('stonePlating');
                        damage *= (1 + effect.properties.meleeDamageBoost);
                    }
                    if (this.wielder.isSlamming) {
                        damage *= GAME_CONFIG.SAI.SLAM_DAMAGE_MULTIPLIER;
                    }
                    npc.takeDamage(damage);

                    // Apply bleeding effect if enemy HP is low
                    if (npc.health.currentHealth / npc.health.maxHealth < GAME_CONFIG.BLEEDING.HP_THRESHOLD_PERCENT) {
                        // Only add if not already bleeding to prevent stacking/refreshing
                        if (!npc.statusEffects.has('bleeding')) {
                            const bleedingEffect = new BleedingEffect(npc);
                            npc.statusEffects.addEffect(bleedingEffect);
                        }
                    }
                }
            }
        }
    }

    update(deltaTime) {
        super.update(deltaTime); // Update cooldown timer

        if (this.state === 'idle') {
            // Lerp group to idle position
            this.mesh.position.lerp(this.idlePosition, 10 * deltaTime);
            this.mesh.quaternion.slerp(this.qIdle, 10 * deltaTime);

            // Also lerp individual sais back to their idle positions/rotations within the group
            this.leftSai.position.lerp(this.leftSaiIdlePos, 10 * deltaTime);
            this.rightSai.position.lerp(this.rightSaiIdlePos, 10 * deltaTime);
            this.leftSai.quaternion.slerp(new THREE.Quaternion(), 10 * deltaTime);
            this.rightSai.quaternion.slerp(new THREE.Quaternion(), 10 * deltaTime);
            return;
        }

        this.animationProgress += deltaTime;
        const p = Math.min(this.animationProgress / this.animationDuration, 1.0); // Normalized progress

        switch(this.state) {
            case 'swinging':
                this.updateSwingAnimation(p);
                break;
            case 'inspecting':
                this.updateInspectAnimation(p);
                break;
        }
        
        if (p >= 1.0) {
            this.state = 'idle';
        }
    }

    updateSwingAnimation(p) {
        const windUpPhaseEnd = 0.25;
        const impactPhaseEnd = 0.7; // Duration of the actual thrust

        // Group movement (slight overall motion)
        this.mesh.position.y = this.idlePosition.y + Math.sin(p * Math.PI) * 0.05; // Up and down slightly
        this.mesh.position.z = this.idlePosition.z + Math.sin(p * Math.PI) * 0.1; // Forward and back slightly

        // Individual Sai animations
        let leftSaiPos = new THREE.Vector3(), rightSaiPos = new THREE.Vector3();
        let leftSaiRot = new THREE.Quaternion(), rightSaiRot = new THREE.Quaternion();
        let easedProgress;

        if (p < windUpPhaseEnd) {
            // Wind-up phase: pull back and turn
            easedProgress = 1 - Math.pow(1 - p / windUpPhaseEnd, 3);
            leftSaiPos.lerpVectors(this.leftSaiIdlePos, new THREE.Vector3(-0.4, 0.1, 0.1), easedProgress);
            rightSaiPos.lerpVectors(this.rightSaiIdlePos, new THREE.Vector3(0.4, 0.1, 0.1), easedProgress);
            leftSaiRot.slerpQuaternions(new THREE.Quaternion(), this.leftSaiWindUpRot, easedProgress);
            rightSaiRot.slerpQuaternions(new THREE.Quaternion(), this.rightSaiWindUpRot, easedProgress);
        } else if (p < impactPhaseEnd) {
            // Impact/Thrust phase: thrust forward, focusing on piercing motion
            easedProgress = (p - windUpPhaseEnd) / (impactPhaseEnd - windUpPhaseEnd);
            // Strong forward movement (Z-axis)
            leftSaiPos.lerpVectors(new THREE.Vector3(-0.4, 0.1, 0.1), new THREE.Vector3(-0.15, 0.0, -0.6), easedProgress); // Increased Z thrust
            rightSaiPos.lerpVectors(new THREE.Vector3(0.4, 0.1, 0.1), new THREE.Vector3(0.15, 0.0, -0.6), easedProgress); // Increased Z thrust
            
            // Aiming rotations (yaw inward, slight pitch down)
            leftSaiRot.slerpQuaternions(this.leftSaiWindUpRot, this.leftSaiImpactRot, easedProgress);
            rightSaiRot.slerpQuaternions(this.rightSaiWindUpRot, this.rightSaiImpactRot, easedProgress);
        } else {
            // Recovery phase: return to idle
            easedProgress = (p - impactPhaseEnd) / (1.0 - impactPhaseEnd);
            leftSaiPos.lerpVectors(new THREE.Vector3(-0.15, 0.0, -0.6), this.leftSaiIdlePos, easedProgress);
            rightSaiPos.lerpVectors(new THREE.Vector3(0.15, 0.0, -0.6), this.rightSaiIdlePos, easedProgress);
            leftSaiRot.slerpQuaternions(this.leftSaiImpactRot, new THREE.Quaternion(), easedProgress);
            rightSaiRot.slerpQuaternions(this.rightSaiImpactRot, new THREE.Quaternion(), easedProgress);
        }

        this.leftSai.position.copy(leftSaiPos);
        this.rightSai.position.copy(rightSaiPos);
        this.leftSai.quaternion.copy(leftSaiRot);
        this.rightSai.quaternion.copy(rightSaiRot);
    }
    
    updateInspectAnimation(p) {
        const upPhaseEnd = 0.2;
        const mainInspectEnd = 0.8;
    
        let easedProgress;
        
        // Group movement
        if (p < upPhaseEnd) {
            easedProgress = 1 - Math.pow(1 - p / upPhaseEnd, 3);
            this.mesh.position.lerpVectors(this.idlePosition, this.inspectUpPos, easedProgress);
            this.mesh.quaternion.slerpQuaternions(this.qIdle, this.qInspectUp, easedProgress);
        } else if (p < mainInspectEnd) {
            easedProgress = (p - upPhaseEnd) / (mainInspectEnd - upPhaseEnd);
            // Oscillate around inspectUpPos
            this.mesh.position.copy(this.inspectUpPos);
            this.mesh.quaternion.slerpQuaternions(this.qInspectUp, this.qInspectUp, easedProgress); // Stay at up rotation
            
            // Individual Sais rotate around their own axes
            this.leftSai.rotation.y = Math.sin(easedProgress * Math.PI * 4) * Math.PI * 0.1;
            this.rightSai.rotation.y = -Math.sin(easedProgress * Math.PI * 4) * Math.PI * 0.1;
            
            this.leftSai.rotation.z = Math.sin(easedProgress * Math.PI * 2) * Math.PI * 0.05;
            this.rightSai.rotation.z = Math.sin(easedProgress * Math.PI * 2) * Math.PI * 0.05;

        } else {
            // Return to idle
            easedProgress = (p - mainInspectEnd) / (1.0 - mainInspectEnd);
            this.mesh.position.lerpVectors(this.inspectUpPos, this.idlePosition, easedProgress);
            this.mesh.quaternion.slerpQuaternions(this.qInspectUp, this.qIdle, easedProgress);

            this.leftSai.quaternion.slerp(new THREE.Quaternion(), easedProgress);
            this.rightSai.quaternion.slerp(new THREE.Quaternion(), easedProgress);
        }
    }
}