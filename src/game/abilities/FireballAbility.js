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
     * @protected
     */
    _executeCast() {
        new Fireball(this.caster); // Creates the projectile
        return true;
    }
}