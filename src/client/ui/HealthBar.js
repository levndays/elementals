import * as THREE from 'three';

/**
 * A client-side visual component representing an entity's health.
 * It is positioned and managed by a client-side system.
 */
export class HealthBar {
    constructor(scene) {
        this.scene = scene;
        
        const healthBarGroup = new THREE.Group();
        // Give the group a high renderOrder so it draws on top of most 3D geometry
        healthBarGroup.renderOrder = 999; 

        // Background
        const bgMaterial = new THREE.SpriteMaterial({ color: 0x550000, sizeAttenuation: false, depthTest: false });
        const bgSprite = new THREE.Sprite(bgMaterial);
        bgSprite.scale.set(0.25, 0.025, 1.0);
        bgSprite.renderOrder = 0; // Render background first
        healthBarGroup.add(bgSprite);

        // Foreground
        const fgMaterial = new THREE.SpriteMaterial({ color: 0x00ff00, sizeAttenuation: false, depthTest: false });
        this.fgSprite = new THREE.Sprite(fgMaterial);
        this.fgSprite.scale.set(0.25, 0.025, 1.0);
        // No need for position.z offset if renderOrder is used for layering transparent sprites
        this.fgSprite.renderOrder = 1; // Render foreground on top
        healthBarGroup.add(this.fgSprite);

        this.group = healthBarGroup;
        this.group.visible = false;
        this.scene.add(this.group);
    }

    update(position, currentHealth, maxHealth) {
        const percent = Math.max(0, currentHealth / maxHealth);
        this.fgSprite.scale.x = 0.25 * percent;
        this.fgSprite.position.x = -0.5 * (0.25 * (1 - percent));

        // Update color based on health percentage
        if (percent < 0.3) this.fgSprite.material.color.setHex(0xff0000);
        else if (percent < 0.6) this.fgSprite.material.color.setHex(0xffff00);
        else this.fgSprite.material.color.setHex(0x00ff00);

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