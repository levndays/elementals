// src/game/weapons/CustomWeapon.js
import * as THREE from 'three';
import { Weapon } from './Weapon.js';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';
import { BleedingEffect } from '../effects/BleedingEffect.js';
import { GAME_CONFIG } from '../../shared/config.js';

/**
 * A weapon instantiated from dynamic asset data created in the Asset Editor.
 */
export class CustomWeapon extends Weapon {
    constructor(assetData) {
        super(null, {
            name: assetData.assetName,
            damage: assetData.damage || 50,
            cooldown: assetData.cooldown || 0.5,
        });

        console.log(`[CustomWeapon] Constructor called for: ${assetData.assetName}`, assetData);

        this.assetData = assetData;
        this.range = assetData.range || 100;
        this.attackType = assetData.attackType || 'ranged';

        // Ranged weapon properties
        this.magazineSize = assetData.magazineSize || 0;
        this.magazineAmmo = this.magazineSize;
        this.reserveAmmo = assetData.reserveAmmo || 0;
        this.isReloading = false;
        
        this.parts = new Map();
        this.createMesh();
        this.wielder = null;
    }

    createMesh() {
        console.log('[CustomWeapon] createMesh called.');
        this.mesh = new THREE.Group();
        this.mesh.name = this.assetData.assetName;

        if (!this.assetData.geometry || this.assetData.geometry.length === 0) {
            console.error(`[CustomWeapon] No geometry data found for ${this.assetData.assetName}! Cannot create mesh.`);
            return;
        }
        console.log(`[CustomWeapon] Found ${this.assetData.geometry.length} parts to create.`);

        const geometryMap = {
            'Box': (s) => new THREE.BoxGeometry(s[0] || 1, s[1] || 1, s[2] || 1),
            'Cylinder': (s) => new THREE.CylinderGeometry(s[0] || 0.5, s[2] || 0.5, s[1] || 1, 16),
            'Sphere': (s) => new THREE.SphereGeometry(s[0] || 0.5, 16, 16),
        };

        for (const partData of this.assetData.geometry) {
            const geoFn = geometryMap[partData.type];
            if (!geoFn) {
                console.warn(`[CustomWeapon] Unknown geometry type: ${partData.type}`);
                continue;
            }
            
            console.log(`[CustomWeapon] Creating part: ${partData.name} (${partData.type})`);

            const matData = partData.material || {};
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(matData.color || '#cccccc'),
                metalness: matData.metalness ?? 0.5,
                roughness: matData.roughness ?? 0.5,
            });

            const scale = partData.transform.scale || [1, 1, 1];
            const partMesh = new THREE.Mesh(geoFn(scale), material);
            partMesh.name = partData.name;
            
            this.parts.set(partData.uuid, partMesh);
        }

        for (const partData of this.assetData.geometry) {
            const partMesh = this.parts.get(partData.uuid);
            if (!partMesh) continue;

            const { position, quaternion, rotation } = partData.transform;
            if (position) partMesh.position.fromArray(position);
            
            if (quaternion) {
                partMesh.quaternion.fromArray(quaternion);
            } else if (rotation) { // Legacy Euler support
                partMesh.rotation.fromArray(rotation.map(d => THREE.MathUtils.degToRad(d)));
            }
            
            const parent = partData.parent ? this.parts.get(partData.parent) : this.mesh;
            parent.add(partMesh);
        }

        // Apply initial viewmodel transform if it exists in the data
        if (this.assetData.viewModel) {
            const { position, rotation } = this.assetData.viewModel;
            if (position) this.mesh.position.fromArray(position);
            if (rotation) {
                this.mesh.rotation.fromArray(rotation.map(d => THREE.MathUtils.degToRad(d)), 'YXZ');
            }
        }
        console.log('[CustomWeapon] Mesh created successfully.', this.mesh);
    }

    attack() {
        if (!this.canAttack() || !this.wielder) return false;

        this.triggerCooldown();

        if (this.attackType === 'melee') {
            this._performMeleeAttack();
        } else {
            this._performRangedAttack();
        }

        // TODO: Implement a proper animation system for CustomWeapon
        return true;
    }

    _performMeleeAttack() {
        const forward = new THREE.Vector3();
        this.wielder.camera.getWorldDirection(forward);
        const playerPos = this.wielder.physics.body.position;

        for (const npc of this.wielder.world.getEnemies()) {
            if (npc.isDead || !npc.physics.body) continue;

            const npcPos = npc.physics.body.position;
            const distance = playerPos.distanceTo(npcPos);

            if (distance < this.range + npc.physics.body.shapes[0].radius) {
                const toNPC = new THREE.Vector3().subVectors(npcPos, playerPos).normalize();
                if (forward.dot(toNPC) > 0.64) {
                    let finalDamage = this.damage;
                    // Apply bleeding effect if defined for this weapon
                    if (this.assetData.id === 'WEAPON_SAI' && npc.health.currentHealth / npc.health.maxHealth < GAME_CONFIG.BLEEDING.HP_THRESHOLD_PERCENT) {
                        if (!npc.statusEffects.has('bleeding')) {
                            npc.statusEffects.addEffect(new BleedingEffect(npc));
                        }
                    }
                    npc.takeDamage(finalDamage);
                }
            }
        }
    }

    _performRangedAttack() {
        if (this.magazineAmmo <= 0) {
            // this.reload(); // Future implementation
            return;
        }
        this.magazineAmmo--;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: 0, y: 0 }, this.wielder.camera);

        const enemyMeshes = this.wielder.world.getEnemies().map(e => e.mesh).filter(Boolean);
        const worldMeshes = this.wielder.world.getLevelObjects().map(e => e.mesh).filter(Boolean);
        const entitiesToTest = [...enemyMeshes, ...worldMeshes];

        const intersects = raycaster.intersectObjects(entitiesToTest, true);
        let hitPoint = raycaster.ray.at(this.range, new THREE.Vector3());

        if (intersects.length > 0) {
            const hit = intersects[0];
            if (hit.distance < this.range) {
                hitPoint = hit.point;
                const gameEntityLink = hit.object.userData.gameEntity;
                if (gameEntityLink?.type === 'NPC' && gameEntityLink.entity.team === 'enemy') {
                    gameEntityLink.entity.takeDamage(this.damage);
                }
            }
        }
        
        this.wielder.world.emit('weaponFired', { weapon: this, hitPoint });
    }

    update(deltaTime) {
        super.update(deltaTime);
        // Animation logic would go here if not handled by a dedicated system
    }
}