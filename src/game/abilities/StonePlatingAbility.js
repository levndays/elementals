import { Ability } from './Ability.js';

export class StonePlatingAbility extends Ability {
    constructor(caster, abilityData) {
        super(caster, abilityData);
        this.duration = 15.0;
        this.buffIsActive = false;
        this.buffTimer = 0;
    }

    _executeCast() {
        if (this.buffIsActive) return false;

        this.buffIsActive = true;
        this.buffTimer = 0;

        // Apply the buff
        this.caster.activeBuffs.set('stonePlating', {
            duration: this.duration,
            damageReduction: 0.80,
            meleeDamageBoost: 0.30
        });
        
        // Notify systems that the buff is active
        this.caster.world.emit('playerBuffActivated', { buffName: 'stonePlating' });

        return true;
    }

    update(deltaTime) {
        // This is called for all abilities, even inactive ones, to handle their main cooldown
        super.update(deltaTime);

        // Only process buff logic if it's currently active on this instance
        if (this.buffIsActive) {
            this.buffTimer += deltaTime;
            if (this.buffTimer >= this.duration) {
                this.removeBuff();
            }
        }
    }

    removeBuff() {
        this.buffIsActive = false;
        this.caster.activeBuffs.delete('stonePlating');
        
        // Notify systems that the buff has ended
        this.caster.world.emit('playerBuffDeactivated', { buffName: 'stonePlating' });
    }
}