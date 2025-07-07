// src/client/rendering/shaders/waterfall.frag
precision mediump float;

uniform float uTime;
uniform sampler2D uFlowTexture;
uniform sampler2D uNoiseTexture;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDirection;

void main() {
    // --- 1. UV & Time Setup ---
    // REVISED: Using addition (+) makes the texture sample "higher" over time,
    // which results in a downward scrolling effect on a standard plane.
    vec2 flowUv1 = vUv * vec2(1.0, 4.0) + vec2(0.0, uTime * 0.8);
    vec2 flowUv2 = vUv * vec2(1.4, 6.0) + vec2(0.0, uTime * 1.3);
    vec2 distortionUv = vUv * 0.5 + vec2(0.0, uTime * 0.05);

    // --- 2. Texture Sampling for Water Flow ---
    float distortion = texture2D(uNoiseTexture, distortionUv).r * 0.05;
    float flow1 = texture2D(uFlowTexture, flowUv1 + distortion).r;
    float flow2 = texture2D(uFlowTexture, flowUv2 + distortion).r;
    
    // The mainFlow determines the density/opacity of the water streaks.
    float mainFlow = smoothstep(0.1, 0.7, flow1 * flow2);

    // --- 3. Foam Calculation ---
    // Foam is concentrated at the top and bottom of the fall.
    float foamTop = smoothstep(0.0, 0.15, vUv.y);
    float foamBottom = smoothstep(1.0, 0.85, vUv.y);
    float foamY = foamTop + foamBottom;

    // Use noise to give the foam a dynamic, cloudy texture.
    vec2 foamUv = vUv * vec2(3.0, 1.0) + vec2(0.0, uTime * 0.4);
    float foamNoise = texture2D(uNoiseTexture, foamUv).r;
    float foam = foamY * foamNoise;
    // Sharpen the foam to make it look more distinct.
    foam = smoothstep(0.6, 1.0, foam);

    // --- 4. Color and Alpha Composition ---
    vec3 waterColor = vec3(0.7, 0.85, 1.0);
    vec3 foamColor = vec3(1.0, 1.0, 1.0);

    // The final color is a blend between water and foam.
    // The amount of foam determines the blend factor.
    vec3 finalColor = mix(waterColor, foamColor, foam);

    // The alpha channel is crucial. It's based on the water flow, with foam being more opaque.
    // This creates the semi-transparent, streaky look.
    float finalAlpha = mainFlow * 0.4 + foam * 0.6;
    
    // Fade the sides to prevent a hard edge.
    float edgeFade = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
    finalAlpha *= edgeFade;

    // --- 5. Fresnel Sheen ---
    // Instead of adding brightness, the fresnel effect will make the edges slightly more opaque,
    // simulating a water surface sheen.
    float fresnel = pow(1.0 - dot(normalize(vNormal), vViewDirection), 3.0);
    finalAlpha = clamp(finalAlpha + fresnel * 0.3, 0.0, 1.0);

    // --- 6. Final Output ---
    // Discard fully transparent pixels to improve performance.
    if (finalAlpha < 0.01) {
        discard;
    }

    // By not having excessively bright colors (most values are <= 1.0), we avoid the "glowing wall" effect.
    gl_FragColor = vec4(finalColor, finalAlpha);
}