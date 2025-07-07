import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from '../entities/Player.js';
import { WeaponFactory } from '../weapons/WeaponFactory.js';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';
import { GAME_CONFIG } from '../../shared/config.js';

/**
 * A factory for creating the player entity with all its required components.
 */
export class PlayerPrefab {
    static create(world, camera, viewModelScene, loadoutData) {
        const { physics } = world;
        const config = GAME_CONFIG.PLAYER;

        const shape = new CANNON.Sphere(config.RADIUS);
        const material = new CANNON.Material({ name: 'playerMaterial', friction: 0.0 });
        const body = new CANNON.Body({
            mass: config.MASS,
            shape,
            material,
            fixedRotation: true,
            allowSleep: false,
            collisionFilterGroup: COLLISION_GROUPS.PLAYER,
            collisionFilterMask: COLLISION_GROUPS.WORLD | COLLISION_GROUPS.ENEMY | COLLISION_GROUPS.ENEMY_PROJECTILE | COLLISION_GROUPS.TRIGGER | COLLISION_GROUPS.WATER,
            linearDamping: config.DEFAULT_DAMPING,
            // --- CONTINUOUS COLLISION DETECTION (CCD) ---
            // Activate CCD if speed exceeds 15 m/s to prevent tunneling.
            ccdSpeedThreshold: 15, 
            // Set the radius for the swept sphere check, slightly smaller than the actual radius.
            ccdSweptSphereRadius: 0.75, 
        });
        const playerWorldContactMaterial = new CANNON.ContactMaterial(
            physics.world.defaultMaterial, material,
            { friction: 0.0, restitution: 0.0, contactEquationStiffness: 1e8, contactEquationRelaxation: 3, frictionEquationStiffness: 1e8 }
        );
        physics.addContactMaterial(playerWorldContactMaterial);
        
        const weaponId = loadoutData?.weapon || 'WEAPON_001';
        const weapon = WeaponFactory.create(weaponId);

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
        directionalLight.position.set(0.5, 0.8, -0.2).normalize();
        
        if (weapon?.mesh) {
            camera.add(weapon.mesh);
        }
        viewModelScene.add(ambientLight, directionalLight, camera);
        
        const entity = new Player(world, camera, weapon, body);
        entity.applyLoadout(loadoutData || { cards: [null, null, null, null], weapon: null });
        
        return entity;
    }
}