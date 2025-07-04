// ~ src/client/rendering/Minimap.js
import * as THREE from 'three';

/**
 * Renders the minimap onto a 2D canvas, showing the player, enemies, allies, and level geometry.
 */
export class Minimap {
    constructor() {
        this.canvas = document.getElementById('minimap-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.size = this.canvas.width;
        this.worldScale = 30.0; // World units from center to edge of map

        // Style configuration
        this.bgColor = 'rgba(10, 10, 10, 0.7)';
        this.borderColor = 'rgba(255, 255, 255, 0.3)';
        this.playerColor = '#2ed573';
        this.enemyColor = '#ff4757';
        this.allyColor = '#4a90e2'; // Blue for allies
        this.objectColor = 'rgba(255, 255, 255, 0.2)';

        // Reusable vector for performance
        this.playerForward = new THREE.Vector3();
    }

    /**
     * Updates and draws the minimap.
     * @param {Player} player The player instance from the game world.
     * @param {NPC[]} npcs Array of NPC instances.
     * @param {Object[]} levelObjects Array of level object instances.
     */
    update(player, npcs, levelObjects) {
        if (!player || player.isDead || !this.ctx) {
            this.ctx?.clearRect(0, 0, this.size, this.size);
            return;
        }

        const playerPos = player.physics.body.position;
        player.camera.getWorldDirection(this.playerForward);
        this.playerForward.y = 0; // Flatten for 2D rotation
        this.playerForward.normalize();

        // Clear and draw background
        this.ctx.clearRect(0, 0, this.size, this.size);
        this.ctx.fillStyle = this.bgColor;
        this.ctx.beginPath();
        this.ctx.arc(this.size / 2, this.size / 2, this.size / 2, 0, Math.PI * 2);
        this.ctx.fill();

        // --- Transformation Setup ---
        const mapRadius = this.size / 2;
        const scale = mapRadius / this.worldScale;
        const rotationAngle = Math.atan2(this.playerForward.x, this.playerForward.z);

        this.ctx.save();
        this.ctx.translate(mapRadius, mapRadius);
        this.ctx.rotate(-rotationAngle); // Rotate canvas opposite to player's rotation

        // --- Draw Level Geometry ---
        this.ctx.fillStyle = this.objectColor;
        for (const obj of levelObjects) {
            if (!obj.mesh || !obj.definition) continue;

            const dx = obj.mesh.position.x - playerPos.x;
            const dz = obj.mesh.position.z - playerPos.z;

            if (Math.sqrt(dx * dx + dz * dz) > this.worldScale * 1.5) continue;

            const width = obj.definition.size[0] * scale;
            const depth = obj.definition.size[2] * scale;

            this.ctx.save();
            this.ctx.translate(dx * scale, -dz * scale);
            if (obj.definition.rotation) {
                this.ctx.rotate(THREE.MathUtils.degToRad(obj.definition.rotation.y || 0));
            }
            this.ctx.fillRect(-width / 2, -depth / 2, width, depth);
            this.ctx.restore();
        }

        // --- Draw NPCs (Enemies and Allies) ---
        for (const npc of npcs) {
            if (npc.isDead || !npc.physics?.body) continue;

            this.ctx.fillStyle = npc.team === 'enemy' ? this.enemyColor : this.allyColor;

            const dx = npc.physics.body.position.x - playerPos.x;
            const dz = npc.physics.body.position.z - playerPos.z;

            if (Math.sqrt(dx * dx + dz * dz) < this.worldScale) {
                this.ctx.beginPath();
                this.ctx.arc(dx * scale, -dz * scale, 4, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        this.ctx.restore(); // Restore context to pre-rotation state

        // --- Draw Player (always at center, facing up) ---
        this.ctx.save();
        this.ctx.translate(mapRadius, mapRadius);
        this.ctx.fillStyle = this.playerColor;
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -8);
        this.ctx.lineTo(6, 6);
        this.ctx.lineTo(-6, 6);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();

        // --- Draw Border ---
        this.ctx.strokeStyle = this.borderColor;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(mapRadius, mapRadius, mapRadius - 2, 0, Math.PI * 2);
        this.ctx.stroke();
    }
}