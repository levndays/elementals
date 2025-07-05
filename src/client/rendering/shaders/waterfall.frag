// src/client/rendering/shaders/waterfall.frag
precision mediump float;

uniform float uTime;
uniform sampler2D uFlowTexture;
uniform sampler2D uNoiseTexture;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
    // --- Scrolling UVs ---
    // The main flow scrolls quickly down the Y axis.
    vec2 flowUv = vUv * vec2(1.0, 4.0) + vec2(0.0, -uTime * 0.4);
    // The noise scrolls slower and slightly sideways for distortion.
    vec2 noiseUv = vUv * vec2(1.5, 2.0) + vec2(uTime * 0.05, -uTime * 0.15);

    // --- Texture Sampling ---
    // Sample the flow texture and use its red channel.
    float flow = texture2D(uFlowTexture, flowUv).r;
    // Sample the noise texture.
    float noise = texture2D(uNoiseTexture, noiseUv).r;

    // --- Combine Textures ---
    // Add noise to the flow UVs to create distorted, non-uniform movement.
    vec2 distortedUv = flowUv + vec2(noise - 0.5, 0.0) * 0.1;
    float distortedFlow = texture2D(uFlowTexture, distortedUv).r;

    // --- Alpha Masking ---
    // Fade out the sides of the waterfall plane.
    float edgeFade = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
    // Create foam at the top by fading in, and fade out at the bottom.
    float verticalFade = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.95, vUv.y);

    float finalAlpha = distortedFlow * edgeFade * verticalFade;

    // --- Final Color ---
    // Base color is a translucent white.
    vec3 waterColor = vec3(0.8, 0.9, 1.0);
    // Add a subtle fresnel effect to make edges glow slightly.
    float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
    vec3 finalColor = waterColor + fresnel * 0.2;

    if (finalAlpha < 0.1) {
        discard;
    }

    gl_FragColor = vec4(finalColor, finalAlpha * 0.7);
}