// ~ src/game/weapons/Katana.js
import * as THREE from 'three';
import { Weapon } from './Weapon.js';
import { GAME_CONFIG } from '../../shared/config.js';

export class Katana extends Weapon {
    constructor() {
        super(null, {
            name: 'Katana',
            damage: GAME_CONFIG.KATANA.DAMAGE,
            cooldown: GAME_CONFIG.KATANA.COOLDOWN,
        });

        this.swingRange = GAME_CONFIG.KATANA.RANGE;
        
        // REWORK: State management for animations
        this.state = 'idle'; // idle, swinging, inspecting
        this.animationProgress = 0;
        this.animationDuration = 0;

        // Internal helpers
        this._forward = new THREE.Vector3();
        this._npcPos = new THREE.Vector3();
        
        this._defineKeyframes();
        this.createMesh();
        
        this.mesh.position.copy(this.idlePosition);
        this.mesh.quaternion.copy(this.qIdle);
    }

    _defineKeyframes() {
        // --- Swing Animation ---
        this.swingDuration = 0.45;
        this.hitTiming = 120; // ms
        this.idlePosition = new THREE.Vector3(0.35, -0.35, -0.7);
        this.windUpPosition = new THREE.Vector3(0.5, 0.4, -0.6);
        this.followThroughPosition = new THREE.Vector3(-0.4, -0.5, -0.7);
        const idleRotation = new THREE.Euler(THREE.MathUtils.degToRad(10), THREE.MathUtils.degToRad(-15), THREE.MathUtils.degToRad(5), 'YXZ');
        const windUpRotation = new THREE.Euler(THREE.MathUtils.degToRad(70), THREE.MathUtils.degToRad(30), THREE.MathUtils.degToRad(-20), 'YXZ');
        const followThroughRotation = new THREE.Euler(THREE.MathUtils.degToRad(-45), THREE.MathUtils.degToRad(-40), THREE.MathUtils.degToRad(45), 'YXZ');
        this.qIdle = new THREE.Quaternion().setFromEuler(idleRotation);
        this.qWindUp = new THREE.Quaternion().setFromEuler(windUpRotation);
        this.qFollowThrough = new THREE.Quaternion().setFromEuler(followThroughRotation);

        // --- NEW: Inspect Animation ---
        this.p_inspect_up = new THREE.Vector3(0.1, -0.1, -0.6);
        this.q_inspect_up = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, -0.2, 0.2, 'YXZ'));
        this.p_inspect_flat = this.p_inspect_up.clone();
        this.q_inspect_flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.4, 0.1, -0.2, 'YXZ'));
    }

    createMesh() {
        this.mesh = new THREE.Group();
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.9, roughness: 0.3 });
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.7, 0.01), bladeMat);
        blade.position.y = 0.7 / 2 + 0.02 / 2;
        blade.castShadow = true;
        
        const guardMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.5 });
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.15), guardMat);
        guard.castShadow = true;
        
        const hiltMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
        const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.25, 8), hiltMat);
        hilt.position.y = -0.25 / 2 - 0.02 / 2;
        hilt.castShadow = true;
        
        this.mesh.add(blade, guard, hilt);
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
        if (this.state !== 'idle') return;
        this.state = 'inspecting';
        this.animationDuration = 2.5;
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
                if (this._forward.dot(toNPC) > 0.64) {
                    let damage = this.damage;
                    if (this.wielder.statusEffects.has('stonePlating')) {
                        const effect = this.wielder.statusEffects.get('stonePlating');
                        damage *= (1 + effect.properties.meleeDamageBoost);
                    }
                    if (this.wielder.isSlamming) {
                        damage *= GAME_CONFIG.KATANA.SLAM_DAMAGE_MULTIPLIER;
                    }
                    npc.takeDamage(damage);
                }
            }
        }
    }

    update(deltaTime) {
        super.update(deltaTime);
        if (this.state === 'idle') {
            this.mesh.position.lerp(this.idlePosition, 10 * deltaTime);
            this.mesh.quaternion.slerp(this.qIdle, 10 * deltaTime);
            return;
        }

        this.animationProgress += deltaTime;
        const p = Math.min(this.animationProgress / this.animationDuration, 1.0);

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
        const windUpPhaseEnd = 0.20;
        const slashPhaseEnd = 0.60;

        let currentPosition = new THREE.Vector3();
        let currentQuaternion = new THREE.Quaternion();
        let phaseProgress, easedProgress;

        if (p < windUpPhaseEnd) {
            phaseProgress = p / windUpPhaseEnd;
            easedProgress = 1 - Math.pow(1 - phaseProgress, 3);
            currentPosition.lerpVectors(this.idlePosition, this.windUpPosition, easedProgress);
            currentQuaternion.slerpQuaternions(this.qIdle, this.qWindUp, easedProgress);
        } else if (p < slashPhaseEnd) {
            phaseProgress = (p - windUpPhaseEnd) / (slashPhaseEnd - windUpPhaseEnd);
            easedProgress = 1 - Math.pow(1 - phaseProgress, 4);
            currentPosition.lerpVectors(this.windUpPosition, this.followThroughPosition, easedProgress);
            currentQuaternion.slerpQuaternions(this.qWindUp, this.qFollowThrough, easedProgress);
        } else {
            phaseProgress = (p - slashPhaseEnd) / (1.0 - slashPhaseEnd);
            easedProgress = phaseProgress < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            currentPosition.lerpVectors(this.followThroughPosition, this.idlePosition, easedProgress);
            currentQuaternion.slerpQuaternions(this.qFollowThrough, this.qIdle, easedProgress);
        }

        this.mesh.position.copy(currentPosition);
        this.mesh.quaternion.copy(currentQuaternion);
    }
    
    updateInspectAnimation(p) {
        const p1_end = 0.15, p2_end = 0.8, p3_end = 1.0;
        let phaseProgress, easedProgress;
        let currentPosition = new THREE.Vector3();
        let currentQuaternion = new THREE.Quaternion();
    
        if (p < p1_end) {
            phaseProgress = p / p1_end;
            easedProgress = 1 - Math.pow(1 - phaseProgress, 3);
            currentPosition.lerpVectors(this.idlePosition, this.p_inspect_up, easedProgress);
            currentQuaternion.slerpQuaternions(this.qIdle, this.q_inspect_up, easedProgress);
        } else if (p < p2_end) {
            phaseProgress = (p - p1_end) / (p2_end - p1_end);
            easedProgress = phaseProgress < 0.5 ? 4 * phaseProgress**3 : 1 - Math.pow(-2 * phaseProgress + 2, 3) / 2;
            currentPosition.lerpVectors(this.p_inspect_up, this.p_inspect_flat, easedProgress);
            currentQuaternion.slerpQuaternions(this.q_inspect_up, this.q_inspect_flat, easedProgress);
        } else {
            phaseProgress = (p - p2_end) / (p3_end - p2_end);
            easedProgress = 1 - Math.pow(1 - phaseProgress, 3);
            currentPosition.lerpVectors(this.p_inspect_flat, this.idlePosition, easedProgress);
            currentQuaternion.slerpQuaternions(this.q_inspect_flat, this.qIdle, easedProgress);
        }
    
        this.mesh.position.copy(currentPosition);
        this.mesh.quaternion.copy(currentQuaternion);
    }
}