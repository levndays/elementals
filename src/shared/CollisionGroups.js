// src/shared/CollisionGroups.js
// Defines distinct bit Categ for physics objects.
// This allows fine-grained control over which objects can collide with each other.
// Each category should be a power of 2.

export const COLLISION_GROUPS = {
    WORLD:             1,
    PLAYER:            2,
    ALLY:              4,
    ENEMY:             8,
    PLAYER_PROJECTILE: 16,
    ENEMY_PROJECTILE:  32,
    TRIGGER:           64,
    VISION_BLOCKER:    128, // Blocks AI line of sight
    WATER:             256,
};

export const RENDERING_LAYERS = {
    DEFAULT: 0,
    NO_REFLECTION: 1,
    VIEWMODEL: 2,
};