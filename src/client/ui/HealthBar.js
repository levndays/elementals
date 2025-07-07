// ~ src/client/ui/HealthBar.js
import * as THREE from 'three';
import { RENDERING_LAYERS } from '../../shared/CollisionGroups.js';

/**
 * A client-side visual component representing an entity's health.
 * It is positioned and managed by a client-side system.
 */
export class HealthBar {
    constructor(scene, team = 'enemy') {
        this.scene = scene;
        this.team = team;
        
        const healthBarGroup = new THREE.Group();
        // Give the group a high renderOrder so it draws on top of most 3D geometry
        healthBarGroup.renderOrder = 999; 

        // Determine colors based on team
        const bgColor = this.team === 'enemy' ? 0x551111 : 0x112255; // Dark red for enemy, dark blue for ally
        const fgColor = this.team === 'enemy' ? 0xff4757 : 0x4a90e2; // Bright red for enemy, bright blue for ally

        // Background
        const bgMaterial = new THREE.SpriteMaterial({ color: bgColor, sizeAttenuation: false, depthTest: false });
        const bgSprite = new THREE.Sprite(bgMaterial);
        bgSprite.scale.set(0.25, 0.025, 1.0);
        bgSprite.renderOrder = 0; // Render background first
        healthBarGroup.add(bgSprite);

        // Foreground
        const fgMaterial = new THREE.SpriteMaterial({ color: fgColor, sizeAttenuation: false, depthTest: false });
        this.fgSprite = new THREE.Sprite(fgMaterial);
        this.fgSprite.scale.set(0.25, 0.025, 1.0);
        this.fgSprite.renderOrder = 1; // Render foreground on top
        healthBarGroup.add(this.fgSprite);

        this.group = healthBarGroup;
        this.group.layers.enable(RENDERING_LAYERS.NO_REFLECTION);
        this.group.visible = false;
        this.scene.add(this.group);
    }

    update(position, currentHealth, maxHealth) {
        const percent = Math.max(0, currentHealth / maxHealth);
        this.fgSprite.scale.x = 0.25 * percent;
        // Adjust the position of the foreground sprite so it drains from the right
        this.fgSprite.position.x = -0.5 * (0.25 * (1 - percent));
        
        // Color is now set in the constructor and doesn't change based on percentage,
        // which provides a clear and consistent visual language (red=enemy, blue=ally).

        this.group.position.copy(position);
    }

    setVisible(visible) {
        this.group.visible = visible;
    }

    dispose() {
        this.scene.remove(this.group);
        this.fgSprite.material.dispose();
        this.group.children[0].material.dispose();
    }
}