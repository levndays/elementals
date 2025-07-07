uniform float uTime;
uniform float uScale;
uniform vec3 uGravity;

attribute vec3 velocity;
attribute vec4 aLifetime; // x: maxLifetime, y: spawnTime

varying float vAlpha;

void main() {
    float maxLifetime = aLifetime.x;
    float spawnTime = aLifetime.y;

    float timeAlive = uTime - spawnTime;

    // If particle is "dead" or not yet born, hide it.
    if (timeAlive > maxLifetime || timeAlive < 0.0) {
        vAlpha = 0.0;
        gl_Position = vec4(1000.0, 1000.0, 1000.0, 1.0); // Move off-screen
        return;
    }
    
    // Standard kinematic equation for position under constant acceleration (gravity)
    vec3 newPosition = position + velocity * timeAlive + 0.5 * uGravity * timeAlive * timeAlive;
    
    vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
    
    // Set point size based on distance to camera
    gl_PointSize = uScale * (1.0 - (timeAlive / maxLifetime)) * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    // Fade out over lifetime
    vAlpha = 1.0 - (timeAlive / maxLifetime);
}