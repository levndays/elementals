// Defines distinct bit Categ for physics objects.
// This allows fine-grained control over which objects can collide with each other.
// Each category should be a power of 2.

export const COLLISION_GROUPS = {
    WORLD: 1,      // Static level geometry
    PLAYER: 2,     // Player characters
    PROJECTILE: 4, // Player and enemy projectiles
    ENEMY: 8,      // AI-controlled characters
    TRIGGER: 16    // Non-colliding trigger volumes
};