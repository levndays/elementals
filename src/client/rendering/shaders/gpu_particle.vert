uniform float uTime;
uniform float uScale;

attribute vec3 velocity;
attribute vec4 aLifetime; // x: maxLifetime, y: spawnTime

varying float vAlpha;

void main() {
    float maxLifetime = aLifetime.x;
    float spawnTime = aLifetime.y;

    float lifeProgress = (uTime - spawnTime) / maxLifetime;

    // If particle is "dead" or not yet born, hide it.
    if (lifeProgress > 1.0 || lifeProgress < 0.0) {
        vAlpha = 0.0;
        gl_Position = vec4(1000.0, 1000.0, 1000.0, 1.0);
        return;
    }
    
    // Simple physics: pos = initial_pos + velocity * time_since_spawn
    vec3 newPosition = position + velocity * (uTime - spawnTime);

    // Add some turbulence/noise for more organic movement
    newPosition.x += sin(newPosition.y * 2.0 + uTime) * 0.1;
    newPosition.z += cos(newPosition.y * 2.0 + uTime) * 0.1;
    
    vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
    
    // Set point size based on distance to camera
    gl_PointSize = uScale * (1.0 - lifeProgress) * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    // Fade out over lifetime
    vAlpha = 1.0 - lifeProgress;
}