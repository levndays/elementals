// src/core/Physics.js

import * as CANNON from 'cannon-es';

export class Physics {
    constructor() {
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0),
            allowSleep: true,
        });

        // ЗАМЕНА АЛГОРИТМА НА БОЛЕЕ НАДЕЖНЫЙ ДЛЯ СТАТИЧЕСКИХ МИРОВ
        this.world.broadphase = new CANNON.NaiveBroadphase();

        this.bodiesToRemove = new Set();
    }

    addContactMaterial(material) {
        this.world.addContactMaterial(material);
    }

    addBody(body) {
        this.world.addBody(body);
    }

    queueForRemoval(body) {
        if (body) {
            this.bodiesToRemove.add(body);
        }
    }
    
    _removeQueuedBodies() {
        if (this.bodiesToRemove.size > 0) {
            for (const body of this.bodiesToRemove) {
                this.world.removeBody(body);
            }
            this.bodiesToRemove.clear();
        }
    }

    update(deltaTime) {
        this.world.step(1 / 60, deltaTime, 3);
        this._removeQueuedBodies();
    }
}