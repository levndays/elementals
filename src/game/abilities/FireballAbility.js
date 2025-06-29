import { Ability } from './Ability.js';
import { Fireball } from './Fireball.js';

export class FireballAbility extends Ability {
    constructor(caster) {
        super(caster, {
            name: 'Fireball',
            icon: 'FB',
            cooldown: 0.5,
            energyCost: 100,
        });
    }

    /**
     * @override
     */
    cast() {
        if (this.canCast()) {
            new Fireball(this.caster); // Creates the projectile
            this.caster.currentEnergy -= this.energyCost;
            this.caster.lastAbilityTime = this.caster.world.time; // For energy regen delay
            this.triggerCooldown();
            
            console.log(`Casted ${this.name}. Energy: ${this.caster.currentEnergy}/${this.caster.maxEnergy}`);
            return true;
        }
        return false;
    }
}