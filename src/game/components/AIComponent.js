// ~ src/game/components/AIComponent.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Data component storing state and parameters for an AI-controlled entity.
 */
export class AIComponent {
    constructor() {
        this.state = 'IDLE'; // e.g., IDLE, SEARCHING, COMBAT, REPOSITIONING
        this.target = null;
        
        // --- Perception ---
        this.lastKnownPlayerPosition = new CANNON.Vec3();
        this.perception = {
            detectionRange: 40,
            loseSightRange: 50,
            attackRange: 30,
            meleeAttackRange: 2.5,
            optimalRange: 22,
            minimumRange: 10,
            hasLineOfSight: false,
            distanceToPlayer: Infinity,
        };

        // --- Timers & Cooldowns ---
        this.aiUpdateInterval = 0.1; // Stagger AI logic updates for performance
        this.aiUpdateTimer = Math.random() * this.aiUpdateInterval; // Random initial offset
        
        this.actionTimers = {
            attack: 1.5,
            meleeAttack: 1.0,
            jump: 2.0,
            dash: 2.0,
            reposition: 3.0,
        };
        
        this.actionCooldowns = {
            attack: 1.5,
            meleeAttack: 1.0,
            jump: 2.0,
            dash: 2.0,
            reposition: 3.0,
        };

        // --- Movement & States---
        this.strafeDirection = 1;
        this.isDashing = false;
        this.dashDuration = 0.2;
        this.dashStateTimer = 0;
        this.dashDirection = new THREE.Vector3();
        this.isKnockedBack = false;
        this.knockbackTimer = 0;
    }
}