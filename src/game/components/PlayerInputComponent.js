import * as THREE from 'three';

/**
 * Data component storing processed input state for a player-controlled entity.
 * This decouples the entity from the raw input manager.
 */
export class PlayerInputComponent {
    constructor() {
        this.moveDirection = new THREE.Vector3();
        this.lookDirection = new THREE.Quaternion();
        
        this.jumpRequested = false;
        this.dashRequested = false;
        this.slamRequested = false;
        this.slamHeld = false; // For continuous press detection

        this.firePrimary = false;
        this.fireSecondary = false;
        
        this.abilitySlotRequested = -1; // -1 means no request, 0-3 for slots
        this.swimDirection = 0; // -1 for down, 0 for neutral, 1 for up
    }
}