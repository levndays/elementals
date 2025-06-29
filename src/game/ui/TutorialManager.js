import * as CANNON from 'cannon-es';
import * as THREE from 'three';

export class TutorialManager {
    constructor(game) {
        this.game = game;
        this.world = game.physics.world;
        this.scene = game.renderer.scene;
        this.hud = game.hud;
        this.triggers = []; // Now stores {mesh, body}
        this.collisionHandler = this.onPlayerCollide.bind(this);
    }

    loadTriggers(triggersData) {
        this.clearTriggers();
        if (!triggersData || triggersData.length === 0) return;

        triggersData.forEach(data => {
            // --- Visual Mesh ---
            const geometry = new THREE.BoxGeometry(...data.size);
            const material = new THREE.MeshBasicMaterial({
                color: parseInt(data.color || "0xffffff", 16),
                transparent: true,
                opacity: 0.25,
                depthWrite: false, // Prevents weird rendering artifacts with other transparent objects
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(data.position.x, data.position.y, data.position.z);
            this.scene.add(mesh);
            
            // --- Physics Body ---
            const shape = new CANNON.Box(new CANNON.Vec3(data.size[0] / 2, data.size[1] / 2, data.size[2] / 2));
            const body = new CANNON.Body({
                type: CANNON.Body.STATIC,
                isTrigger: true // Player can pass through, but it still detects collision
            });
            body.addShape(shape);
            body.position.copy(mesh.position);
            
            // Attach our custom data to the physics body
            body.tutorialData = {
                message: data.message,
                duration: data.duration || 5,
                hasFired: false
            };
            
            this.world.addBody(body);
            this.triggers.push({ mesh, body });
        });
        
        // Listen for collisions on the player's body
        this.game.player.body.addEventListener('collide', this.collisionHandler);
    }

    onPlayerCollide(event) {
        const contactBody = event.body;
        const tutorialData = contactBody.tutorialData;

        if (tutorialData && !tutorialData.hasFired) {
            this.hud.showTutorialText(tutorialData.message, tutorialData.duration);
            tutorialData.hasFired = true; // Fire only once

            // Find the corresponding mesh and make it fade out
            const trigger = this.triggers.find(t => t.body === contactBody);
            if (trigger && trigger.mesh) {
                // Simple fade out effect
                let currentOpacity = trigger.mesh.material.opacity;
                const fadeInterval = setInterval(() => {
                    currentOpacity -= 0.05;
                    if (currentOpacity <= 0) {
                        trigger.mesh.visible = false;
                        clearInterval(fadeInterval);
                    } else {
                        trigger.mesh.material.opacity = currentOpacity;
                    }
                }, 20);
            }
        }
    }

    clearTriggers() {
        if (this.game.player?.body) {
            this.game.player.body.removeEventListener('collide', this.collisionHandler);
        }
        this.triggers.forEach(({ mesh, body }) => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
            this.world.removeBody(body)
        });
        this.triggers = [];
    }
}