// src/client/rendering/FireballVisual.js

import * as THREE from 'three';

/**
 * Manages the visual representation of a Fireball projectile.
 */
export class FireballVisual {
    constructor(fireballEntity, scene) {
        this.entity = fireballEntity;
        this.scene = scene;
        
        const geometry = new THREE.SphereGeometry(this.entity.RADIUS, 16, 16);
        const material = new THREE.MeshStandardMaterial({
            color: 0xff8800, emissive: 0xff4400, emissiveIntensity: 5
        });
        this.mesh = new THREE.Mesh(geometry, material);

        this.light = new THREE.PointLight(0xffaa33, 500, 100, 2);
        this.mesh.add(this.light);
        
        // Link mesh to entity for sync systems
        this.entity.mesh = this.mesh;
        this.mesh.userData.entity = this.entity;

        this.scene.add(this.mesh);
    }

    update(deltaTime) {
        if (!this.entity || (this.entity.isDead && this.entity.state === 'TRAVELING')) {
            // Logical entity was removed before visual could react, clean up.
            // The VFXManager will call dispose.
            return;
        }

        switch (this.entity.state) {
            case 'TRAVELING':
                if (this.entity.body) {
                    this.mesh.position.copy(this.entity.body.position);
                }
                break;
            case 'LINGERING':
                this.handleExplosion(deltaTime);
                break;
            case 'SHRINKING': // This state is now implicitly handled by LINGERING's end
                this.handleExplosion(deltaTime);
                break;
        }
    }

    handleExplosion(deltaTime) {
        this.mesh.position.copy(this.entity.aoeBody.position);

        const GROW_DURATION = 0.2;
        const SHRINK_DURATION = 0.5;
        const FINAL_SCALE = 40;

        // Growing phase
        if (this.entity.stateTimer < GROW_DURATION) {
            const progress = this.entity.stateTimer / GROW_DURATION;
            const scale = THREE.MathUtils.lerp(1, FINAL_SCALE, progress);
            this.mesh.scale.setScalar(scale);
            this.light.intensity = THREE.MathUtils.lerp(500, 2000, progress);
        } 
        // Lingering phase (includes shrinking at the end)
        else {
            const lingerTime = this.entity.stateTimer - GROW_DURATION;
            const lingerProgress = lingerTime / this.entity.LINGER_DURATION;
            
            // Pulse effect
            const pulse = Math.sin(lingerTime * Math.PI * 4) * 0.5 + 0.5;
            this.mesh.material.emissiveIntensity = THREE.MathUtils.lerp(8, 12, pulse);
            
            // Shrink in the last part of the linger duration
            const shrinkStartTime = this.entity.LINGER_DURATION - SHRINK_DURATION;
            if (lingerTime > shrinkStartTime) {
                const shrinkProgress = (lingerTime - shrinkStartTime) / SHRINK_DURATION;
                const scale = THREE.MathUtils.lerp(FINAL_SCALE, 0, shrinkProgress);
                this.mesh.scale.setScalar(scale);
                this.light.intensity = THREE.MathUtils.lerp(2000, 0, shrinkProgress);
            } else {
                 this.mesh.scale.setScalar(FINAL_SCALE);
            }
        }
    }
    
    dispose() {
        if (!this.scene) return; // Already disposed

        if (this.entity) {
            this.entity.mesh = null; // Unlink
        }

        this.scene.remove(this.mesh);
        this.mesh.geometry?.dispose();
        this.mesh.material?.dispose();
        this.light?.dispose();
        this.scene = null;
        this.entity = null;
    }
}