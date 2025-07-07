// [ ~ src/client/rendering/shaders/waterfall.frag ]
precision mediump float;

uniform float uTime;
uniform sampler2D uFlowTexture;
uniform sampler2D uNoiseTexture;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDirection;

void main() {
    // --- 1. UV & Time Setup ---
    vec2 flowUv1 = vUv * vec2(1.0, 4.0) + vec2(0.0, uTime * 0.8);
    vec2 flowUv2 = vUv * vec2(1.4, 6.0) + vec2(0.0, uTime * 1.3);
    vec2 distortionUv = vUv * 0.5 + vec2(0.0, uTime * 0.05);

    // --- 2. Texture Sampling for Water Flow ---
    float distortion = texture2D(uNoiseTexture, distortionUv).r * 0.05;
    float flow1 = texture2D(uFlowTexture, flowUv1 + distortion).r;
    float flow2 = texture2D(uFlowTexture, flowUv2 - distortion).r;
    
    float mainFlow = smoothstep(0.1, 0.7, flow1 * flow2);

    // --- 3. Foam Calculation ---
    float foamY = smoothstep(0.0, 0.15, vUv.y) + smoothstep(1.0, 0.85, vUv.y);
    vec2 foamUv = vUv * vec2(3.0, 1.0) + vec2(0.0, uTime * 0.4);
    float foamNoise = texture2D(uNoiseTexture, foamUv).r;
    float foam = smoothstep(0.6, 1.0, foamY * foamNoise);

    // --- 4. Color and Alpha Composition ---
    vec3 waterColor = vec3(0.6, 0.75, 0.9);
    vec3 foamColor = vec3(1.0, 1.0, 1.0);
    vec3 finalColor = mix(waterColor, foamColor, foam);

    float alpha = mainFlow * 0.3 + foam * 0.6;
    float edgeFade = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
    
    // --- 5. Fresnel Sheen ---
    // The vNormal is already normalized in the vertex shader.
    float fresnel = pow(1.0 - dot(vNormal, vViewDirection), 2.0);
    float finalAlpha = clamp(alpha * edgeFade + fresnel * 0.2, 0.0, 1.0);

    // --- 6. Final Output ---
    if (finalAlpha < 0.01) {
        discard;
    }
    gl_FragColor = vec4(finalColor, finalAlpha);
}