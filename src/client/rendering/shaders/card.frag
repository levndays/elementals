uniform float uTime;
uniform vec3 uElementColor;
uniform int uElementId; // 0:Fire, 1:Water, 2:Air, 3:Earth, 4:Utility
uniform sampler2D uTextTexture;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDirection;

// Note: The noise function is prepended in CardObject.js

#define PI 3.14159265359

float circleSDF(vec2 p, float r) { return length(p) - r; }
float boxSDF(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float lineSDF(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }

mat2 rotate2d(float angle) { return mat2(cos(angle), -sin(angle), sin(angle), cos(angle)); }
float opUnion(float d1, float d2) { return min(d1, d2); }
float opSubtraction(float d1, float d2) { return max(-d1, d2); }

float fireSigil(vec2 p) {
    p.y -= 0.1; float finalShape = 1.0;
    for(int i = 0; i < 3; i++) {
        float angle = (float(i) / 3.0) * (2.0 * PI) + uTime * 0.5;
        vec2 rp = p * rotate2d(angle); rp.y -= 0.35;
        float flame = opUnion(opUnion(circleSDF(rp, 0.08), boxSDF(rp - vec2(0.0, 0.1), vec2(0.02, 0.1))), circleSDF(rp - vec2(0.0, 0.25), 0.03));
        finalShape = opUnion(finalShape, flame);
    }
    return finalShape;
}
float waterSigil(vec2 p) {
    float wave1 = p.y + sin(p.x * 5.0 + uTime * 2.0) * 0.1 - 0.2;
    float wave2 = p.y + cos(p.x * 4.0 - uTime * 1.5) * 0.1;
    float wave3 = p.y + sin(p.x * 6.0 + uTime * 1.0) * 0.1 + 0.2;
    float d = 1.0; d = opUnion(d, abs(wave1) - 0.02); d = opUnion(d, abs(wave2) - 0.02); d = opUnion(d, abs(wave3) - 0.02);
    d = max(d, abs(p.x) - 0.4); d = max(d, abs(p.y) - 0.4);
    return d;
}
float airSigil(vec2 p) {
    float d = 1.0;
    for(int i = 0; i < 5; i++) {
        float fi = float(i); float t = uTime * 0.3 + fi * 0.5; vec2 lp = p * rotate2d(t * 2.0);
        lp.x -= (sin(t) + 1.0) * 0.2;
        d = opUnion(d, boxSDF(lp, vec2(0.2, 0.01)));
    }
    return d;
}

// REWORK: Replaced with an additive construction of four independently trembling squares.
float earthSigil(vec2 p) {
    vec2 b = vec2(0.08); // half-width of each square
    float c = 0.2;       // center offset for each square
    float trembleAmount = 0.02;

    // Unique 2D noise offsets for each square's center
    vec2 offset1 = (vec2(cnoise(vec2(uTime * 5.0, 1.0)), cnoise(vec2(uTime * 5.0, 1.5))) - 0.5) * trembleAmount;
    vec2 offset2 = (vec2(cnoise(vec2(uTime * 5.0, 2.0)), cnoise(vec2(uTime * 5.0, 2.5))) - 0.5) * trembleAmount;
    vec2 offset3 = (vec2(cnoise(vec2(uTime * 5.0, 3.0)), cnoise(vec2(uTime * 5.0, 3.5))) - 0.5) * trembleAmount;
    vec2 offset4 = (vec2(cnoise(vec2(uTime * 5.0, 4.0)), cnoise(vec2(uTime * 5.0, 4.5))) - 0.5) * trembleAmount;

    float d1 = boxSDF(p - (vec2(c, c) + offset1), b);
    float d2 = boxSDF(p - (vec2(-c, c) + offset2), b);
    float d3 = boxSDF(p - (vec2(-c, -c) + offset3), b);
    float d4 = boxSDF(p - (vec2(c, -c) + offset4), b);

    return min(min(d1, d2), min(d3, d4));
}

float utilitySigil(vec2 p) {
    p *= rotate2d(uTime * 0.2); float d = 1.0;
    for(int i=0; i<6; i++) { d = opUnion(d, lineSDF(p * rotate2d(float(i) * PI / 3.0), vec2(0.0), vec2(0.3, 0.0)) - 0.02); }
    return opSubtraction(d, circleSDF(p, 0.15));
}

void main() {
    vec2 p = vUv * 2.0 - 1.0; p.y *= 1.75 / 1.25;
    float noise = cnoise(vUv * vec2(3.0, 4.0) + uTime * 0.1);
    vec3 bgColor = mix(vec3(0.05, 0.06, 0.08), uElementColor * 0.5, smoothstep(0.3, 1.0, noise));

    vec2 sigilP = p; sigilP.y -= 0.2;
    float d;
    if (uElementId == 0) d = fireSigil(sigilP);
    else if (uElementId == 1) d = waterSigil(sigilP);
    else if (uElementId == 2) d = airSigil(sigilP);
    else if (uElementId == 3) d = earthSigil(sigilP);
    else if (uElementId == 4) d = utilitySigil(sigilP);
    else d = circleSDF(sigilP, 0.2);

    vec3 sigilColor = uElementColor * 1.5;
    float sigil = 1.0 - smoothstep(-0.01, 0.01, d);
    float glow = (1.0 - smoothstep(-0.1, 0.1, d)) * (sin(uTime * 2.0) * 0.2 + 0.8);
    vec3 finalColor = mix(mix(bgColor, sigilColor * 0.2, glow), sigilColor, sigil);

    vec4 textColor = texture2D(uTextTexture, vUv);
    finalColor = mix(finalColor, textColor.rgb, textColor.a);
    finalColor += pow(1.0 - dot(vNormal, vViewDirection), 3.0) * uElementColor * 0.3;
    gl_FragColor = vec4(finalColor, 1.0);
}