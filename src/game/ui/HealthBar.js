import * as THREE from 'three';

export class HealthBar {
    constructor(entity) {
        this.entity = entity;
        this.scene = entity.scene;

        const healthBarGroup = new THREE.Group();

        // Background
        const bgMaterial = new THREE.SpriteMaterial({ color: 0x550000 });
        const bgSprite = new THREE.Sprite(bgMaterial);
        bgSprite.scale.set(1.0, 0.1, 1.0);
        healthBarGroup.add(bgSprite);

        // Foreground
        const fgMaterial = new THREE.SpriteMaterial({ color: 0x00ff00 });
        this.fgSprite = new THREE.Sprite(fgMaterial);
        this.fgSprite.scale.set(1.0, 0.1, 1.0);
        this.fgSprite.position.z = 0.1; // Render on top of background
        healthBarGroup.add(this.fgSprite);

        this.group = healthBarGroup;
        this.group.position.y = 1.5; // Offset above the entity's center
        this.entity.mesh.add(this.group);
    }

    updateHealth(currentHealth, maxHealth) {
        const percent = Math.max(0, currentHealth / maxHealth);
        this.fgSprite.scale.x = percent;
        // The sprite is centered, so we need to shift its position as it scales down.
        this.fgSprite.position.x = -0.5 * (1 - percent);

        if (percent < 0.3) {
            this.fgSprite.material.color.setHex(0xff0000); // Red
        } else if (percent < 0.6) {
            this.fgSprite.material.color.setHex(0xffff00); // Yellow
        } else {
            this.fgSprite.material.color.setHex(0x00ff00); // Green
        }
    }

    setVisible(visible) {
        this.group.visible = visible;
    }

    dispose() {
        this.entity.mesh.remove(this.group);
        this.fgSprite.material.dispose();
        this.group.children[0].material.dispose(); // bg material
    }
}