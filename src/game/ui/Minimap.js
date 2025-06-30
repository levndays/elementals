import * as THREE from 'three';

export class Minimap {
    constructor() {
        this.canvas = document.getElementById('minimap-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.size = this.canvas.width;
        this.worldScale = 30.0; // How many world units fit into the map's radius (distance from center to edge)

        // Colors
        this.bgColor = 'rgba(10, 10, 10, 0.7)';
        this.borderColor = 'rgba(255, 255, 255, 0.3)';
        this.playerColor = '#2ed573';
        this.enemyColor = '#ff4757';
        this.objectColor = 'rgba(255, 255, 255, 0.2)'; // Color for level objects

        // Reusable vectors for calculations
        this.playerForward = new THREE.Vector3();
        this._tempVec3 = new THREE.Vector3();
    }

    /**
     * Updates and draws the minimap.
     * @param {Player} player The player instance.
     * @param {Enemy[]} enemies Array of enemy instances.
     * @param {Object[]} levelObjects Array of level object instances.
     */
    update(player, enemies, levelObjects) {
        if (!player || player.isDead || !this.ctx) {
            this.ctx?.clearRect(0, 0, this.size, this.size);
            return;
        };

        const playerPos = player.body.position;
        player.camera.getWorldDirection(this.playerForward); // Get player's camera forward direction
        this.playerForward.y = 0; // Ignore vertical component for 2D map rotation
        this.playerForward.normalize();

        // --- Clear and draw background ---
        this.ctx.clearRect(0, 0, this.size, this.size);
        this.ctx.fillStyle = this.bgColor;
        this.ctx.beginPath();
        this.ctx.arc(this.size / 2, this.size / 2, this.size / 2, 0, Math.PI * 2);
        this.ctx.fill();

        // --- World to map scale ---
        const mapRadius = this.size / 2;
        const scale = mapRadius / this.worldScale;

        // Calculate the angle to rotate the world view so player always faces upwards
        // This is the angle from the world Z-axis to the player's forward vector
        const rotationAngle = Math.atan2(this.playerForward.x, this.playerForward.z);

        // Save context and apply translation/rotation for drawing world objects relative to player
        this.ctx.save();
        this.ctx.translate(this.size / 2, this.size / 2); // Move origin to center of minimap
        this.ctx.rotate(-rotationAngle); // Rotate canvas opposite to player's rotation

        // --- Draw Level Objects (e.g., Boxes and Planes) ---
        this.ctx.fillStyle = this.objectColor;
        for (const obj of levelObjects) {
            // Only draw objects that are visually part of the level, not helpers etc.
            if (!obj.mesh || !obj.definition) continue;

            const mesh = obj.mesh;
            const def = obj.definition;

            // Calculate position relative to player
            const dx = mesh.position.x - playerPos.x;
            const dz = mesh.position.z - playerPos.z;
            
            // Check if object is within a reasonable display range to avoid drawing too many
            if (Math.sqrt(dx * dx + dz * dz) > this.worldScale * 1.5) continue; 

            if (def.type === 'Box') {
                const width = def.size[0] * scale;
                const depth = def.size[2] * scale;

                this.ctx.save();
                this.ctx.translate(dx * scale, -dz * scale); // Translate to object's map position
                // Apply object's own rotation if it's a box
                if (def.rotation) {
                    const objRotationY = THREE.MathUtils.degToRad(def.rotation.y || 0);
                    this.ctx.rotate(objRotationY);
                }
                this.ctx.fillRect(-width / 2, -depth / 2, width, depth);
                this.ctx.restore();

            } else if (def.type === 'Plane') {
                const radius = def.size[0] * scale / 2; // Assuming plane is square
                this.ctx.beginPath();
                this.ctx.arc(dx * scale, -dz * scale, radius, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        // --- Draw Enemies ---
        this.ctx.fillStyle = this.enemyColor;
        for (const enemy of enemies) {
            if (enemy.isDead || !enemy.body) continue;

            const dx = enemy.body.position.x - playerPos.x;
            const dz = enemy.body.position.z - playerPos.z;

            const distFromPlayer = Math.sqrt(dx * dx + dz * dz);
            // Only draw if within minimap's worldScale range
            if (distFromPlayer < this.worldScale) { 
                 const mapX = dx * scale;
                 const mapY = -dz * scale; // Y is inverted in canvas coordinates

                 this.ctx.beginPath();
                 this.ctx.arc(mapX, mapY, 4, 0, Math.PI * 2); // Draw as a small circle
                 this.ctx.fill();
            }
        }

        // Restore context before drawing player marker
        this.ctx.restore();

        // --- Draw Player (always at center, facing up) ---
        this.ctx.save();
        this.ctx.translate(this.size / 2, this.size / 2);
        this.ctx.fillStyle = this.playerColor;
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -8); // Tip of triangle
        this.ctx.lineTo(6, 6);  // Bottom right
        this.ctx.lineTo(-6, 6); // Bottom left
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();

        // --- Draw border ---
        this.ctx.strokeStyle = this.borderColor;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(this.size / 2, this.size / 2, mapRadius - 2, 0, Math.PI * 2);
        this.ctx.stroke();
    }
}