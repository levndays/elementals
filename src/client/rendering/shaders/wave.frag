// src/client/rendering/shaders/wave.frag
precision mediump float;

uniform float uTime;
uniform float uProgress;
uniform vec3 uColor;
uniform float uLength;

varying vec2 vUv;

void main() {
    // Wave animation based on UV and time
    float waveSpeed = 8.0;
    float waveFrequency = 10.0;
    float waveHeight = 0.1;

    float wave = sin(vUv.y * waveFrequency - uTime * waveSpeed) * waveHeight;
    wave = smoothstep(0.05, 0.1, wave);

    // Fade effect based on overall progress
    float fadeIn = smoothstep(0.0, 0.2, uProgress);
    float fadeOut = 1.0 - smoothstep(0.7, 1.0, uProgress);
    float alpha = fadeIn * fadeOut;

    // Foam at the front of the wave
    float foamWidth = 0.1;
    // REVERSED: Animate foam from UV.y=1 down to UV.y=0
    float foamPosition = 1.0 - uProgress;
    float foam = smoothstep(foamWidth, 0.0, abs(vUv.y - foamPosition));
    
    vec3 finalColor = uColor * wave + vec3(1.0) * foam;

    gl_FragColor = vec4(finalColor, (wave + foam) * alpha);
}