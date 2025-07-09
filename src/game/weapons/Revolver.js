// ~ src/game/weapons/Revolver.js
import * as THREE from 'three';
import { Weapon } from './Weapon.js';
import { GAME_CONFIG } from '../../shared/config.js';
import { COLLISION_GROUPS } from '../../shared/CollisionGroups.js';

export class Revolver extends Weapon {
    constructor() {
        super(null, {
            name: 'Revolver',
            damage: GAME_CONFIG.REVOLVER.DAMAGE,
            cooldown: GAME_CONFIG.REVOLVER.COOLDOWN,
        });

        this.range = 200;
        this.magazineSize = GAME_CONFIG.REVOLVER.MAGAZINE_SIZE;
        this.magazineAmmo = this.magazineSize;
        this.reserveAmmo = GAME_CONFIG.REVOLVER.RESERVE_AMMO;

        this.state = 'idle'; // idle, firing, reloading, inspecting
        this.animationProgress = 0;
        this.animationDuration = 0;

        this._defineKeyframes();
        this.createMesh();
        
        this.mesh.position.copy(this.p_idle);
        this.mesh.quaternion.copy(this.q_idle);
    }

    _defineKeyframes() {
        // --- Base Positions & Rotations ---
        // Weapon is offset to the right but rotated (yaw) to point towards the center crosshair.
        this.p_idle = new THREE.Vector3(0.3, -0.4, -0.7);
        this.q_idle = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.3, 0));
        
        // --- ADS (Aim Down Sights) - Future Use ---
        // this.p_ads = new THREE.Vector3(0, -0.3, -0.5);
        // this.q_ads = new THREE.Quaternion();

        // --- Reloading Keyframes ---
        this.p_reload_start = new THREE.Vector3(0.3, -0.5, -0.7);
        this.q_reload_start = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.8, -0.4, 0.2));
        
        // --- Inspecting Keyframes ---
        // Player must be out of water to inspect weapon.
        this.inspectDuration = 3.5;
        this.p_inspect_center = new THREE.Vector3(0.1, -0.35, -0.6);
        this.q_inspect_start = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -0.2, 0.5));
        this.q_inspect_roll = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, -0.2, -1.5));
    }

    createMesh() {
        this.mesh = new THREE.Group();
        const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.9, roughness: 0.4 });
        const gripRubber = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });

        // --- Frame ---
        const frameGeo = new THREE.BoxGeometry(0.045, 0.1, 0.14);
        const frame = new THREE.Mesh(frameGeo, darkMetal);
        frame.position.set(0, -0.01, -0.05);

        // --- Barrel Assembly ---
        const barrelAssembly = new THREE.Group();
        barrelAssembly.position.set(0, 0.045, -0.12);
        const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.22), darkMetal);
        shroud.position.z = -0.09;
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 8), darkMetal);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = -0.08;
        barrelAssembly.add(shroud, barrel);

        // --- Top Rail & Sights ---
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.18), darkMetal);
        topRail.position.set(0, 0.08, -0.11);
        const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), darkMetal);
        rearSight.position.set(0, 0.05, 0.02);

        // --- Grip ---
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.16, 8), gripRubber);
        grip.position.set(0, -0.1, 0.01);
        grip.rotation.x = -0.2;
        grip.scale.x = 1.3;

        // --- Cylinder & Crane (for reload animation) ---
        this.crane = new THREE.Group();
        this.crane.position.set(-0.0225, -0.01, -0.05); // Pivot point on the frame
        this.cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 6), darkMetal);
        this.cylinder.rotation.x = Math.PI / 2;
        this.crane.add(this.cylinder);

        // --- Hammer ---
        this.hammer = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.02), darkMetal);
        this.hammer.position.set(0, 0.05, 0.02);
        this.hammer.geometry.translate(0, -0.02, 0); // Set pivot to bottom

        this.mesh.add(frame, barrelAssembly, topRail, rearSight, grip, this.crane, this.hammer);
        this.mesh.scale.setScalar(1.1);
        return this.mesh;
    }

    attack() {
        if (this.state !== 'idle' || !this.canAttack()) return false;
        
        if (this.magazineAmmo <= 0) {
            this.reload();
            return false;
        }

        this.state = 'firing';
        this.animationDuration = this.cooldown * 0.9;
        this.animationProgress = 0;
        this.magazineAmmo--;
        this.triggerCooldown();

        const raycaster = new THREE.Raycaster();
        const camera = this.wielder.camera;
        raycaster.setFromCamera({ x: 0, y: 0 }, camera);
        
        const enemyMeshes = this.wielder.world.getEnemies().map(e => e.mesh).filter(Boolean);
        const worldMeshes = this.wielder.world.getLevelObjects().map(e => e.mesh).filter(Boolean);
        const entitiesToTest = [...enemyMeshes, ...worldMeshes];

        const intersects = raycaster.intersectObjects(entitiesToTest, true);

        let hitPoint = null;
        if (intersects.length > 0) {
            const hit = intersects[0];
            if (hit.distance < this.range) {
                hitPoint = hit.point; // Always set hit point
                const gameEntityLink = hit.object.userData.gameEntity;
                if (gameEntityLink?.type === 'NPC' && gameEntityLink.entity.team === 'enemy') {
                    gameEntityLink.entity.takeDamage(this.damage);
                }
            }
        }
        
        if (!hitPoint) {
            hitPoint = raycaster.ray.at(this.range, new THREE.Vector3());
        }

        this.wielder.world.emit('weaponFired', { weapon: this, hitPoint });

        if (this.magazineAmmo === 0) {
            setTimeout(() => this.reload(), 500);
        }

        return true;
    }

    reload() {
        if (this.state !== 'idle' || this.magazineAmmo === this.magazineSize || this.reserveAmmo <= 0) return;

        this.state = 'reloading';
        this.animationDuration = 2.8;
        this.animationProgress = 0;
    }

    inspect() {
        if (this.state !== 'idle' || this.wielder.isInWater) return;
        this.state = 'inspecting';
        this.animationDuration = this.inspectDuration;
        this.animationProgress = 0;
    }

    update(deltaTime) {
        super.update(deltaTime);
        if (this.state === 'idle') {
            this.mesh.position.lerp(this.p_idle, 10 * deltaTime);
            this.mesh.quaternion.slerp(this.q_idle, 10 * deltaTime);
            this.crane.rotation.y = THREE.MathUtils.lerp(this.crane.rotation.y, 0, 15 * deltaTime);
            this.hammer.rotation.z = THREE.MathUtils.lerp(this.hammer.rotation.z, 0, 15 * deltaTime);
            return;
        }

        this.animationProgress += deltaTime;
        const p = Math.min(this.animationProgress / this.animationDuration, 1.0);

        switch(this.state) {
            case 'firing': this.updateFireAnimation(p, deltaTime); break;
            case 'reloading': this.updateReloadAnimation(p, deltaTime); break;
            case 'inspecting': this.updateInspectAnimation(p); break;
        }
        
        if (p >= 1.0) {
            if (this.state === 'reloading') {
                const ammoNeeded = this.magazineSize - this.magazineAmmo;
                const ammoToReload = Math.min(ammoNeeded, this.reserveAmmo);
                this.magazineAmmo += ammoToReload;
                this.reserveAmmo -= ammoToReload;
            }
            this.state = 'idle';
        }
    }

    updateFireAnimation(p, deltaTime) {
        const kickProgress = Math.sin(p * Math.PI); // A value from 0 -> 1 -> 0

        // Rotational flip
        const kickRotation = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            kickProgress * -0.5 // flip amount
        );
        // Apply the kick rotation relative to the base idle rotation
        this.mesh.quaternion.copy(this.q_idle).multiply(kickRotation);
    
        // Positional kickback
        const kickPosition = this.p_idle.clone();
        kickPosition.z += kickProgress * 0.2; // kickback amount
        this.mesh.position.copy(kickPosition);

        // Hammer animation (this is safe as it's a child object's local rotation)
        const hammerCockBack = -Math.PI / 4;
        if (p < 0.1) this.hammer.rotation.z = THREE.MathUtils.lerp(0, hammerCockBack, p / 0.1);
        else this.hammer.rotation.z = THREE.MathUtils.lerp(hammerCockBack, 0, (p - 0.1) / 0.9);
        
        // Cylinder rotation
        this.cylinder.rotation.y -= deltaTime * 20 * (1 - p);
    }

    updateReloadAnimation(p, deltaTime) {
        // Phase 1: Bring to center and start opening (0.0 -> 0.2)
        const p1 = Math.min(1, p / 0.2);
        this.mesh.position.lerpVectors(this.p_idle, this.p_reload_start, p1);
        this.mesh.quaternion.slerpQuaternions(this.q_idle, this.q_reload_start, p1);

        // Phase 2: Swing cylinder out (0.1 -> 0.4)
        const p2 = Math.min(1, Math.max(0, (p - 0.1) / 0.3));
        const swingOutAngle = -Math.PI / 2.5;
        this.crane.rotation.y = THREE.MathUtils.lerp(0, swingOutAngle, p2);

        // Phase 3: Eject shells (0.4 -> 0.6) - a quick spin
        if (p > 0.4 && p < 0.6) {
            this.cylinder.rotation.y -= deltaTime * 50;
        }

        // Phase 4: Swing cylinder in (0.7 -> 0.9)
        const p4 = Math.min(1, Math.max(0, (p - 0.7) / 0.2));
        this.crane.rotation.y = THREE.MathUtils.lerp(swingOutAngle, 0, p4);

        // Phase 5: Return to idle (0.8 -> 1.0)
        const p5 = Math.min(1, Math.max(0, (p - 0.8) / 0.2));
        this.mesh.position.lerpVectors(this.p_reload_start, this.p_idle, p5);
        this.mesh.quaternion.slerpQuaternions(this.q_reload_start, this.q_idle, p5);
    }
    
    updateInspectAnimation(p) {
        const p1_end = 0.2, p2_end = 0.7, p3_end = 1.0;
        
        if (p < p1_end) { // Move to center
            const progress = p / p1_end;
            this.mesh.position.lerpVectors(this.p_idle, this.p_inspect_center, progress);
            this.mesh.quaternion.slerpQuaternions(this.q_idle, this.q_inspect_start, progress);
        } else if (p < p2_end) { // Roll
            const progress = (p - p1_end) / (p2_end - p1_end);
            this.mesh.quaternion.slerpQuaternions(this.q_inspect_start, this.q_inspect_roll, progress);
            this.cylinder.rotation.y += 0.05 * (1.0 - progress);
        } else { // Return to idle
            const progress = (p - p2_end) / (p3_end - p2_end);
            this.mesh.position.lerpVectors(this.p_inspect_center, this.p_idle, progress);
            this.mesh.quaternion.slerpQuaternions(this.q_inspect_roll, this.q_idle, progress);
        }
    }
}