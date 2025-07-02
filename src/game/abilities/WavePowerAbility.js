// src/game/abilities/WavePowerAbility.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Ability } from './Ability.js';
import { GAME_CONFIG } from '../../shared/config.js';

export class WavePowerAbility extends Ability {
    constructor(caster, abilityData) {
        super(caster, abilityData);
        this.config = GAME_CONFIG.WAVE_POWER;

        // Reusable objects for performance
        this._forward = new THREE.Vector3();
        this._right = new THREE.Vector3();
        this._enemyLocalPos = new THREE.Vector3();
    }
    
    canCast() {
        const isGrounded = this.caster.jumpsRemaining === GAME_CONFIG.PLAYER.MAX_JUMPS;
        return super.canCast() && isGrounded;
    }

    _executeCast() {
        const UP_VECTOR = new THREE.Vector3(0, 1, 0);
        const playerPos = this.caster.physics.body.position;
        this.caster.camera.getWorldDirection(this._forward);
        this._forward.y = 0;
        this._forward.normalize();
        this._right.crossVectors(this._forward, UP_VECTOR);

        // Define the rectangular AoE in front of the player
        const halfWidth = this.config.WIDTH / 2;
        const halfLength = this.config.LENGTH / 2;
        
        // The center of the AoE rectangle
        const center = new THREE.Vector3().copy(playerPos).add(this._forward.clone().multiplyScalar(halfLength));
        
        // Matrix to transform world coordinates to the rectangle's local space
        const worldToLocalMatrix = new THREE.Matrix4().lookAt(this._forward, new THREE.Vector3(0,0,0), UP_VECTOR).setPosition(center).invert();

        let enemiesHit = 0;
        for (const enemy of this.caster.world.getEnemies()) {
            if (enemy.isDead || !enemy.physics.body) continue;

            // Transform enemy position to be relative to the AoE rectangle
            this._enemyLocalPos.copy(enemy.physics.body.position).applyMatrix4(worldToLocalMatrix);

            // Check if the enemy is within the rectangle's bounds
            if (Math.abs(this._enemyLocalPos.x) <= halfWidth && Math.abs(this._enemyLocalPos.z) <= halfLength) {
                this.applyEffect(enemy);
                enemiesHit++;
            }
        }
        
        // Emit event for VFX
        this.caster.world.emit('wavePowerUsed', { position: playerPos, direction: this._forward });

        return true;
    }

    applyEffect(enemy) {
        // Apply damage
        enemy.takeDamage(this.config.DAMAGE);

        // Apply knockback state and force
        enemy.ai.isKnockedBack = true;
        enemy.ai.knockbackTimer = this.config.KNOCKBACK_DURATION;

        const impulseDirection = new CANNON.Vec3().copy(this._forward);
        impulseDirection.y = this.config.IMPULSE_UPWARD / this.config.IMPULSE_FORWARD;
        impulseDirection.normalize();

        const impulse = impulseDirection.scale(this.config.IMPULSE_FORWARD);
        
        enemy.physics.body.applyImpulse(impulse, enemy.physics.body.position);
    }
}