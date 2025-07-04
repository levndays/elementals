// ~ src/client/systems/WorldUISystem.js
import { HealthBar } from '../ui/HealthBar.js';

/**
 * Manages 3D UI elements that exist in the world space, like enemy health bars.
 * It listens to world events to create, update, and destroy these UI elements.
 */
export class WorldUISystem {
    constructor(scene) {
        this.scene = scene;
        this.world = null;
        this.healthBars = new Map(); // Map<entity, HealthBar>
    }

    registerWorld(world) {
        if (this.world) {
            this.dispose(); // Clean up listeners from old world
        }
        this.world = world;
        this._onNPCSpawned = this._onNPCSpawned.bind(this);
        this._onNPCDied = this._onNPCDied.bind(this);

        this.world.on('npcSpawned', this._onNPCSpawned);
        this.world.on('npcDied', this._onNPCDied);
    }
    
    _onNPCSpawned({ npc }) {
        // Create health bars for any NPC (enemy or allied).
        // Player entity is not an NPC, so it will be skipped.
        if ((npc.team === 'enemy' || npc.team === 'player') && !this.healthBars.has(npc)) {
            const healthBar = new HealthBar(this.scene, npc.team);
            this.healthBars.set(npc, healthBar);
        }
    }

    _onNPCDied({ entity }) {
        if (this.healthBars.has(entity)) {
            const healthBar = this.healthBars.get(entity);
            healthBar.dispose();
            this.healthBars.delete(entity);
        }
    }

    update(deltaTime) {
        if (!this.world || !this.world.player) return;

        for (const [entity, healthBar] of this.healthBars.entries()) {
            // Guard against entities that might be disposed but not yet removed from the map
            if (!entity.physics?.body) {
                healthBar.setVisible(false);
                continue;
            }

            if (entity.isDead) {
                healthBar.setVisible(false);
                continue;
            }
            
            const position = entity.physics.body.position.clone();
            position.y += (entity.mesh.geometry.parameters.height || 1.0) + 1.0;

            const isVisible = this.world.player.camera.position.distanceTo(position) < 30;
            healthBar.setVisible(isVisible);

            if (isVisible) {
                healthBar.update(position, entity.health.currentHealth, entity.health.maxHealth);
            }
        }
    }
    
    dispose() {
        if (this.world) {
            this.world.off('npcSpawned', this._onNPCSpawned);
            this.world.off('npcDied', this._onNPCDied);
        }
        for (const healthBar of this.healthBars.values()) {
            healthBar.dispose();
        }
        this.healthBars.clear();
        this.world = null;
    }
}