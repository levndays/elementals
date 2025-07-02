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
        this.isSwinging = false;
        this.swingProgress = 0;
        this.swingDuration = 0.45;
        this.hitTiming = 120; // ms

        this._forward = new THREE.Vector3();
        this._enemyPos = new THREE.Vector3();

        this.idlePosition = new THREE.Vector3(0.4, -0.4, -0.8);
        this.windUpPosition = new THREE.Vector3(0.5, 0.4, -0.6);
        this.followThroughPosition = new THREE.Vector3(-0.4, -0.5, -0.7);

        const idleRotation = new THREE.Euler(THREE.MathUtils.degToRad(25), THREE.MathUtils.degToRad(-20), THREE.MathUtils.degToRad(15), 'YXZ');
        const windUpRotation = new THREE.Euler(THREE.MathUtils.degToRad(70), THREE.MathUtils.degToRad(30), THREE.MathUtils.degToRad(-20), 'YXZ');
        const followThroughRotation = new THREE.Euler(THREE.MathUtils.degToRad(-45), THREE.MathUtils.degToRad(-40), THREE.MathUtils.degToRad(45), 'YXZ');

        this.qIdle = new THREE.Quaternion().setFromEuler(idleRotation);
        this.qWindUp = new THREE.Quaternion().setFromEuler(windUpRotation);
        this.qFollowThrough = new THREE.Quaternion().setFromEuler(followThroughRotation);

        this.createMesh();
        this.mesh.position.copy(this.idlePosition);
        this.mesh.quaternion.copy(this.qIdle);
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
        if (!this.canAttack() || this.isSwinging) return false;
        this.isSwinging = true;
        this.swingProgress = 0;
        this.triggerCooldown();
        setTimeout(() => { if (this.isSwinging) this.detectHit(); }, this.hitTiming);
        return true;
    }

    detectHit() {
        if (!this.wielder) return;

        this.wielder.camera.getWorldDirection(this._forward);
        const playerPos = this.wielder.physics.body.position;

        for (const enemy of this.wielder.world.getEnemies()) {
            if (enemy.isDead || !enemy.physics.body) continue;

            this._enemyPos.copy(enemy.physics.body.position);
            const distance = playerPos.distanceTo(this._enemyPos);

            if (distance < this.swingRange + enemy.physics.body.shapes[0].radius) {
                const toEnemy = this._enemyPos.clone().sub(playerPos).normalize();
                if (this._forward.dot(toEnemy) > 0.64) {
                    let damage = this.damage;
                    
                    // Apply melee damage boost from buff
                    if (this.wielder.activeBuffs.has('stonePlating')) {
                        const buff = this.wielder.activeBuffs.get('stonePlating');
                        damage *= (1 + buff.meleeDamageBoost);
                    }

                    if (this.wielder.isSlamming) {
                        damage *= GAME_CONFIG.KATANA.SLAM_DAMAGE_MULTIPLIER;
                    }

                    enemy.takeDamage(damage);
                }
            }
        }
    }

    update(deltaTime) {
        super.update(deltaTime);
        if (!this.isSwinging) return;

        this.swingProgress += deltaTime;
        const totalProgress = Math.min(this.swingProgress / this.swingDuration, 1.0);

        const windUpPhaseEnd = 0.20;
        const slashPhaseEnd = 0.60;

        let currentPosition, currentQuaternion, phaseProgress, easedProgress;
        currentPosition = new THREE.Vector3();
        currentQuaternion = new THREE.Quaternion();

        if (totalProgress < windUpPhaseEnd) {
            phaseProgress = totalProgress / windUpPhaseEnd;
            easedProgress = 1 - Math.pow(1 - phaseProgress, 3);
            currentPosition.lerpVectors(this.idlePosition, this.windUpPosition, easedProgress);
            currentQuaternion.slerpQuaternions(this.qIdle, this.qWindUp, easedProgress);
        } else if (totalProgress < slashPhaseEnd) {
            phaseProgress = (totalProgress - windUpPhaseEnd) / (slashPhaseEnd - windUpPhaseEnd);
            easedProgress = 1 - Math.pow(1 - phaseProgress, 4);
            currentPosition.lerpVectors(this.windUpPosition, this.followThroughPosition, easedProgress);
            currentQuaternion.slerpQuaternions(this.qWindUp, this.qFollowThrough, easedProgress);
        } else {
            phaseProgress = (totalProgress - slashPhaseEnd) / (1.0 - slashPhaseEnd);
            easedProgress = phaseProgress < 0.5 ? 2 * phaseProgress * phaseProgress : 1 - Math.pow(-2 * phaseProgress + 2, 2) / 2;
            currentPosition.lerpVectors(this.followThroughPosition, this.idlePosition, easedProgress);
            currentQuaternion.slerpQuaternions(this.qFollowThrough, this.qIdle, easedProgress);
        }

        this.mesh.position.copy(currentPosition);
        this.mesh.quaternion.copy(currentQuaternion);

        if (totalProgress >= 1.0) {
            this.isSwinging = false;
        }
    }
}