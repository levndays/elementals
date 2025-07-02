// src/client/rendering/shaders/wave.vert
precision mediump float;

uniform float uTime;
uniform float uProgress;
uniform float uLength;

varying vec2 vUv;

void main() {
    vUv = uv;

    vec3 pos = position;

    // REVERSED: Animate wave crest from one end to the other in reverse.
    // The geometry's original Y-axis is now its local Z-axis.
    // pos.z (in local space) corresponds to the original pos.y.
    float waveFront = (1.0 - uProgress) * uLength - (uLength / 2.0);
    float distToFront = pos.z - waveFront;

    // We now check against local z for the displacement height.
    if (distToFront < 1.0 && distToFront > -2.0) {
        // The displacement itself should be on the Y-axis in world space.
        // After rotation, local Y is world Y, so we displace local Y.
        pos.y += sin(distToFront * 3.14159) * 0.5;
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}