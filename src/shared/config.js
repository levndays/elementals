// src/shared/config.js
// This file centralizes all game balance and configuration constants.
// Modifying these values will directly impact gameplay without needing to change core logic.

export const GAME_CONFIG = {
    // General world settings
    DEATH_Y: -100, // Y-coordinate below which entities are considered out of bounds

    // General physics
    GRAVITY: 9.82,

    // Player movement parameters
    PLAYER: {
        MAX_HEALTH: 1000,
        MAX_ENERGY: 1000,
        ENERGY_REGEN_RATE: 25, // points per second
        ENERGY_REGEN_DELAY: 5.0, // seconds after last ability use
        
        FOV: 75, // Default field of view
        SPEED: 8.0, // meters per second
        JUMP_HEIGHT: 8.0, // initial vertical velocity on jump
        MAX_JUMPS: 2,
        
        DASH_SPEED_MULTIPLIER: 4.0,
        DASH_DURATION: 0.2, // seconds
        DASH_COOLDOWN: 2.0, // seconds
        
        DOUBLE_JUMP_COOLDOWN: 1.5, // seconds
        DOUBLE_TAP_WINDOW: 300, // milliseconds
        
        GROUND_SLAM_VELOCITY: -25.0, // downward velocity on slam
        
        RADIUS: 0.8, // for physics body
        MASS: 70, // kg
    },

    // Weapon parameters
    KATANA: {
        DAMAGE: 250,
        COOLDOWN: 0.6, // seconds
        RANGE: 4.0, // meters
        SLAM_DAMAGE_MULTIPLIER: 2.0,
    },
    
    // Ability-specific parameters
    WAVE_POWER: {
        WIDTH: 8.0, // meters
        LENGTH: 15.0, // meters
        IMPULSE_FORWARD: 3000, // in kg*m/s
        IMPULSE_UPWARD: 1000, // in kg*m/s
        DAMAGE: 200,
        KNOCKBACK_DURATION: 1.0, // seconds
    },

    // Enemy base parameters
    ENEMY: {
        DUMMY: {
            MAX_HEALTH: 500,
            SPEED: 7.0,
            MASS: 80,
            RADIUS: 0.8,
            PROJECTILE_DAMAGE: 100,
            PROJECTILE_SPEED: 40,
            ATTACK_COOLDOWN: 1.5,
        }
    },
    
    // Targeting system parameters
    TARGETING: {
        MAX_RANGE: 100, // meters
        MAX_ANGLE_RAD: Math.atan(0.26), // Approx. 15 degrees tan(15 deg)
    },

    // HUD and UI
    UI: {
        RESPAWN_COOLDOWN: 5.0,
    }
};