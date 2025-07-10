// src/game/systems/NPCAnimationSystem.js
import * as THREE from 'three';
const FADE_DURATION = 0.2; // seconds

/**
 * Manages the animations for all NPC entities in the world.
 */
export class NPCAnimationSystem {
    constructor(world) {
        this._boundOnMeleeAttack = this.onMeleeAttack.bind(this);
        world.on('npcMeleeAttack', this._boundOnMeleeAttack);
    }

    /**
     * @param {import('../world/World.js').World} world
     * @param {number} deltaTime
     */
    update(world, deltaTime) {
        for (const npc of world.getNPCs()) {
            if (npc.isDead || !npc.mixer) continue;

            const newActionName = this._determineAction(npc);
            if (npc.activeAction?.getClip().name !== newActionName) {
                const newActionClip = npc.animations.get(newActionName);
                if (newActionClip) {
                    const newAction = npc.mixer.clipAction(newActionClip);
                    this._crossFadeTo(npc, newAction);
                }
            }
            
            npc.mixer.update(deltaTime);
        }
    }

    onMeleeAttack({ npc }) {
        if (!npc || npc.isDead || !npc.mixer || npc.isAttackingAnimation) return;

        const attackActionClip = npc.animations.get('Run');
        if (!attackActionClip) return;

        const attackAction = npc.mixer.clipAction(attackActionClip);
        npc.isAttackingAnimation = true;
        
        // This makes the run animation look like a quick lunge
        attackAction.setLoop(THREE.LoopOnce);
        attackAction.clampWhenFinished = true;
        attackAction.timeScale = 2.5; // Play it faster
        attackAction.weight = 1;
        
        const onAnimationFinish = (e) => {
            if (e.action === attackAction) {
                npc.isAttackingAnimation = false;
                npc.mixer.removeEventListener('finished', onAnimationFinish);
            }
        };
        npc.mixer.addEventListener('finished', onAnimationFinish);
        
        this._crossFadeTo(npc, attackAction);
    }

    _determineAction(npc) {
        const { ai, physics } = npc;

        // If an attack animation is playing, don't interrupt it.
        if (npc.isAttackingAnimation) {
            return npc.activeAction.getClip().name;
        }

        // Running has the next priority
        if (physics.body.velocity.lengthSquared() > 0.5) {
            return 'Run';
        }

        // Default to Idle
        return 'Idle';
    }

    _crossFadeTo(npc, newAction) {
        const oldAction = npc.activeAction;
        npc.activeAction = newAction;

        if (oldAction && oldAction !== newAction) {
            oldAction.fadeOut(FADE_DURATION);
        }
        
        // Ensure properties are reset unless it's the attack animation that sets its own
        if (!npc.isAttackingAnimation) {
             newAction.setLoop(THREE.LoopRepeat);
             newAction.timeScale = 1;
        }

        newAction.reset()
                 .setEffectiveWeight(1)
                 .fadeIn(FADE_DURATION)
                 .play();
    }

    dispose(world) {
        world.off('npcMeleeAttack', this._boundOnMeleeAttack);
    }
}