uniform float uTime;
uniform vec3 uElementColor;
varying vec2 vUv;

// Note: The noise function is prepended in CardObject.js

void main() {
    float flowingNoise = cnoise(vUv * vec2(1.5, 6.0) + vec2(0.0, uTime * -0.15));
    float bands = smoothstep(0.4, 0.6, flowingNoise);
    vec3 baseColor = vec3(0.08, 0.09, 0.12);
    vec3 finalColor = mix(baseColor, uElementColor * 0.7, bands);
    float borderX = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
    float borderY = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
    float border = borderX * borderY;
    finalColor = mix(uElementColor * 0.2, finalColor, border);
    gl_FragColor = vec4(finalColor, 1.0);
}