import * as CANNON from 'cannon-es';

export class Physics {
    constructor() {
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0)
        });

        // A queue for bodies to be safely removed after the physics step.
        this.bodiesToRemove = [];
    }

    /**
     * Safely queues a physics body for removal from the world.
     * The body will be removed after the next physics step.
     * @param {CANNON.Body} body The body to remove.
     */
    queueForRemoval(body) {
        // Avoid adding the same body multiple times.
        if (body && !this.bodiesToRemove.includes(body)) {
            this.bodiesToRemove.push(body);
        }
    }

    update(deltaTime) {
        // Run the simulation step first.
        this.world.step(1 / 60, deltaTime, 3);

        // AFTER the simulation, safely remove any bodies from the queue.
        if (this.bodiesToRemove.length > 0) {
            for (const body of this.bodiesToRemove) {
                this.world.removeBody(body);
            }
            // Clear the queue for the next frame.
            this.bodiesToRemove = [];
        }
    }
}