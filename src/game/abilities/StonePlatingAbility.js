 import { Ability } from './Ability.js';
    import { StatusEffect } from '../effects/StatusEffect.js';
    
    export class StonePlatingAbility extends Ability {
        constructor(caster, abilityData) {
            super(caster, abilityData);
            this.duration = 15.0;
        }
    
        _executeCast() {
            if (this.caster.statusEffects.has('stonePlating')) return false;
    
            const effect = new StatusEffect(this.caster, {
                name: 'stonePlating',
                duration: this.duration,
                properties: {
                    damageReduction: 0.80,
                    meleeDamageBoost: 0.30
                },
                onApply: (target) => {
                    target.world.emit('playerBuffActivated', { buffName: 'stonePlating' });
                },
                onRemove: (target) => {
                    target.world.emit('playerBuffDeactivated', { buffName: 'stonePlating' });
                }
            });
    
            this.caster.statusEffects.addEffect(effect);
            
            return true;
        }
    
        update(deltaTime) {
            // This is called for all abilities, even inactive ones, to handle their main cooldown
            super.update(deltaTime);
            // The active buff logic is now handled by the StatusEffectSystem
        }
    }