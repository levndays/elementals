import * as THREE from 'three';

export class Minimap {
    constructor() {
        this.canvas = document.getElementById('minimap-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.size = this.canvas.width;
        this.worldScale = 30.0; // How many world units fit into the map's radius

        // Colors
        this.bgColor = 'rgba(10, 10, 10, 0.7)';
        this.borderColor = 'rgba(255, 255, 255, 0.3)';
        this.playerColor = '#2ed573';
        this.enemyColor = '#ff4757';
        
        this.playerForward = new THREE.Vector3();
    }

    update(player, enemies) {
        if (!player || player.isDead || !this.ctx) {
            this.ctx?.clearRect(0, 0, this.size, this.size);
            return;
        };

        const playerPos = player.body.position;
        player.camera.getWorldDirection(this.playerForward);

        // --- Clear and draw background ---
        this.ctx.clearRect(0, 0, this.size, this.size);
        this.ctx.fillStyle = this.bgColor;
        this.ctx.beginPath();
        this.ctx.arc(this.size / 2, this.size / 2, this.size / 2, 0, Math.PI * 2);
        this.ctx.fill();

        // --- World to map scale ---
        const mapRadius = this.size / 2;
        const scale = mapRadius / this.worldScale;

        // --- Draw Enemies ---
        this.ctx.fillStyle = this.enemyColor;
        for (const enemy of enemies) {
            if (enemy.isDead) continue;

            const dx = enemy.body.position.x - playerPos.x;
            const dz = enemy.body.position.z - playerPos.z;

            // Rotate enemy position around player to align with map orientation (player always faces up)
            const angleToPlayerForward = Math.atan2(this.playerForward.x, this.playerForward.z);
            const rotatedX = dx * Math.cos(angleToPlayerForward) - dz * Math.sin(angleToPlayerForward);
            const rotatedZ = dx * Math.sin(angleToPlayerForward) + dz * Math.cos(angleToPlayerForward);

            // Convert to map coordinates
            const mapX = (this.size / 2) + rotatedX * scale;
            const mapY = (this.size / 2) - rotatedZ * scale; // Y is inverted in canvas

            // Draw if within map radius
            const distFromCenter = Math.sqrt(Math.pow(mapX - mapRadius, 2) + Math.pow(mapY - mapRadius, 2));
            if (distFromCenter < mapRadius - 5) { // -5 to keep dots from touching edge
                 this.ctx.beginPath();
                 this.ctx.arc(mapX, mapY, 4, 0, Math.PI * 2);
                 this.ctx.fill();
            }
        }

        // --- Draw Player ---
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