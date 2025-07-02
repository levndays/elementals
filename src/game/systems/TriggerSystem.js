// + src/game/systems/TriggerSystem.js

/**
 * A centralized system for handling logic for all trigger volumes.
 * It is event-driven and listens for collision events on trigger entities.
 */
export class TriggerSystem {
    constructor(world) {
        this.world = world;
        this._boundOnEntityAdded = this.onEntityAdded.bind(this);
        this.world.on('entityAdded', this._boundOnEntityAdded);
        this._initAllTriggers();
    }

    /**
     * Iterates through existing triggers in the world and initializes them.
     * This is useful for when the system is created after entities already exist.
     */
    _initAllTriggers() {
        const triggers = [...this.world.getTriggers(), ...this.world.getDeathTriggers()];
        triggers.forEach(trigger => this._initTrigger(trigger));
    }

    /**
     * Initializes a single trigger by attaching a collision handler.
     * @param {object} trigger - The trigger entity.
     */
    _initTrigger(trigger) {
        // Ensure we don't add the same listener multiple times.
        if (trigger.body && !trigger.body.hasEventListener('collide', trigger._collisionHandler)) {
            trigger._collisionHandler = (event) => this.onTriggerCollide(trigger, event);
            trigger.body.addEventListener('collide', trigger._collisionHandler);
        }
    }

    /**
     * Handler for when a new entity is added to the world.
     * If it's a trigger, initialize it.
     * @param {object} entity - The entity that was added.
     */
    onEntityAdded({ entity }) {
        if (entity.type === 'Trigger' || entity.type === 'DeathTrigger') {
            this._initTrigger(entity);
        }
    }

    /**
     * The core collision logic that runs when a trigger's body reports a collision.
     * @param {object} triggerEntity - The trigger volume itself.
     * @param {object} event - The CANNON.js collision event.
     */
    onTriggerCollide(triggerEntity, event) {
        const otherBody = event.body;
        const targetEntity = otherBody?.userData?.entity;

        if (!targetEntity) return;

        // Apply logic based on the type of the trigger volume.
        if (triggerEntity.type === 'DeathTrigger') {
            if (typeof targetEntity.takeDamage === 'function') {
                targetEntity.takeDamage(99999); // Apply lethal damage
            }
        } else if (triggerEntity.type === 'Trigger') {
            // Tutorial message triggers should only affect the player and only fire once.
            if (targetEntity.type === 'player' && !triggerEntity.hasFired) {
                this.world.emit('tutorialTriggerActivated', {
                    message: triggerEntity.message,
                    duration: triggerEntity.duration,
                });
                triggerEntity.hasFired = true;
            }
        }
    }

    /**
     * Cleans up all event listeners when the world is disposed.
     */
    dispose() {
        this.world.off('entityAdded', this._boundOnEntityAdded);
        const triggers = [...this.world.getTriggers(), ...this.world.getDeathTriggers()];
        triggers.forEach(trigger => {
            if (trigger.body && trigger._collisionHandler) {
                trigger.body.removeEventListener('collide', trigger._collisionHandler);
                delete trigger._collisionHandler;
            }
        });
    }
}