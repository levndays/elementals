// src/game/effects/BleedingEffect.js
import { StatusEffect } from './StatusEffect.js';
import { GAME_CONFIG } from '../../shared/config.js';
import * as THREE from 'three'; // Import THREE for color manipulation

/**
 * A status effect that applies damage over time (DoT) to the target.
 */
export class BleedingEffect extends StatusEffect {
    constructor(target) {
        super(target, {
            name: 'bleeding',
            duration: GAME_CONFIG.BLEEDING.DURATION,
            // damagePerTick and tickInterval are properties handled by the effect itself
            // but defined by config.
        });

        this.damagePerTick = GAME_CONFIG.BLEEDING.DAMAGE_PER_TICK;
        this.tickInterval = GAME_CONFIG.BLEEDING.TICK_INTERVAL;
        this.tickTimer = 0; // Tracks time until next damage tick

        // Store original colors for restoration
        this.originalMeshColor = null;
        this.originalEmissiveColor = null;
    }

    onApply(target) {
        // Optional: Add a visual indicator or sound effect when bleeding starts
        // console.log(`${target.name} started bleeding!`);
        if (target.mesh?.material) {
            this.originalMeshColor = target.mesh.material.color.clone();
            this.originalEmissiveColor = target.mesh.material.emissive.clone();

            target.mesh.material.color.setHex(0xff0000); // Tint red
            target.mesh.material.emissive.setHex(0x330000); // Red glow
            target.mesh.material.emissiveIntensity = 0.5;
        }
    }

    onTick(target, deltaTime) {
        this.tickTimer += deltaTime;
        if (this.tickTimer >= this.tickInterval) {
            if (!target.isDead) {
                target.takeDamage(this.damagePerTick);
            }
            this.tickTimer -= this.tickInterval; // Subtract to handle potential frame skips
        }

        // Subtle pulsing effect during bleeding
        if (target.mesh?.material && this.originalEmissiveColor) {
            const pulseIntensity = Math.sin(this.timer * 8) * 0.2 + 0.3; // 0.1 to 0.5
            target.mesh.material.emissiveIntensity = pulseIntensity;
        }
    }

    onRemove(target) {
        // Optional: Clean up visual indicator or sound effect when bleeding ends
        // console.log(`${target.name} stopped bleeding.`);
        if (target.mesh?.material && this.originalMeshColor && this.originalEmissiveColor) {
            target.mesh.material.color.copy(this.originalMeshColor);
            target.mesh.material.emissive.copy(this.originalEmissiveColor);
            target.mesh.material.emissiveIntensity = 1.0; // Reset to default
        }
    }
}