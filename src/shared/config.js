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
        MAX_OXYGEN: 1000,
        ENERGY_REGEN_RATE: 25, // points per second
        ENERGY_REGEN_DELAY: 5.0, // seconds after last ability use
        OXYGEN_CONSUMPTION_RATE: 50, // 1000 / 20 seconds = 50/s
        OXYGEN_REGEN_RATE: 200, // points per second
        OXYGEN_DAMAGE_PER_SECOND: 75,
        
        FOV: 75, // Default field of view
        SPEED: 8.0, // meters per second
        SWIM_SPEED: 6.0, // base vertical/horizontal speed in water
        SWIM_FORCE_MULTIPLIER: 80, // Multiplier for vertical force application
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
        DEFAULT_DAMPING: 0.01,
    },

    // Weapon parameters
    KATANA: {
        DAMAGE: 250,
        COOLDOWN: 0.6, // seconds
        RANGE: 4.0, // meters
        SLAM_DAMAGE_MULTIPLIER: 2.0,
    },
    REVOLVER: { // Added for completeness, but not used by class directly yet
        DAMAGE: 100,
        COOLDOWN: 0.5,
        MAGAZINE_SIZE: 6,
        RESERVE_AMMO: 24,
    },
    SAI: {
        DAMAGE: 150,
        COOLDOWN: 0.7, // Slightly longer cooldown than Katana due to dual hit/bleed potential
        RANGE: 2.5, // Shorter range than Katana as it's more of a thrust
        SLAM_DAMAGE_MULTIPLIER: 1.5, // Less powerful slam than Katana
    },
    
    // Ability-specific parameters
    WAVE_POWER: {
        WIDTH: 8.0, // meters
        LENGTH: 25.0, // meters
        IMPULSE_FORWARD: 3000, // in kg*m/s
        IMPULSE_UPWARD: 1000, // in kg*m/s
        DAMAGE: 200,
        KNOCKBACK_DURATION: 1.0, // seconds
    },

    // Status Effect parameters
    BLEEDING: {
        DURATION: 10.0, // seconds
        DAMAGE_PER_SECOND: 5, // Total damage over duration
        TICK_INTERVAL: 1.0, // seconds between each damage tick
        DAMAGE_PER_TICK: 5, // Calculated: DAMAGE_PER_SECOND * TICK_INTERVAL
        HP_THRESHOLD_PERCENT: 0.5, // Apply bleeding if enemy HP is below this percentage
    },

    // NPC base parameters
    NPC: {
        BASE: {
            MAX_HEALTH: 500,
            SPEED: 7.0,
            MASS: 80,
            RADIUS: 0.8,
        },
        RANGED: {
            PROJECTILE_DAMAGE: 100,
            PROJECTILE_SPEED: 40,
        },
        MELEE: {
            DAMAGE: 150,
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