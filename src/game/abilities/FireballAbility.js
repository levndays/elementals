import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Ability } from './Ability.js';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';

export class FireballAbility extends Ability {
    constructor(caster, abilityData) {
        super(caster, abilityData);
    }

    _executeCast() {
        const camera = this.caster.camera;
        const world = this.caster.world;
        const physics = world.physics;

        const cameraPos = new THREE.Vector3();
        camera.getWorldPosition(cameraPos);
        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir);

        const idealSpawnPoint = cameraPos.clone().add(cameraDir.clone().multiplyScalar(1.5));
        
        const rayFrom = new CANNON.Vec3().copy(cameraPos);
        const rayTo = new CANNON.Vec3().copy(idealSpawnPoint);
        const result = new CANNON.RaycastResult();
        
        physics.world.raycastClosest(rayFrom, rayTo, {
            collisionFilterMask: COLLISION_GROUPS.WORLD 
        }, result);

        let spawnPosition;
        if (result.hasHit) {
            const hitPoint = result.hitPointWorld;
            const nudgeDirection = new CANNON.Vec3();
            rayTo.vsub(rayFrom, nudgeDirection); // Get direction vector safely
            nudgeDirection.normalize();
            
            const nudgeVector = new CANNON.Vec3();
            nudgeDirection.scale(-0.1, nudgeVector); // Scale into new vector
            
            spawnPosition = hitPoint.vadd(nudgeVector);
        } else {
            spawnPosition = rayTo;
        }
        
        this.caster.world.createFireball({ caster: this.caster, spawnPosition });
        return true;
    }
}