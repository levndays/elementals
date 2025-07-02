// + src/client/rendering/shaders/sigil.frag
precision mediump float;

uniform vec3 uElementColor;
uniform int uElementId; // 0:Fire, 1:Water, 2:Air, 3:Earth, 4:Utility
varying vec2 vUv;

#define PI 3.14159265359

// SDF (Signed Distance Function) primitives
float circleSDF(vec2 p, float r) { return length(p) - r; }
float boxSDF(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float lineSDF(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a; vec2 ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }

mat2 rotate2d(float angle) { return mat2(cos(angle), -sin(angle), sin(angle), cos(angle)); }
float opUnion(float d1, float d2) { return min(d1, d2); }
float opSubtraction(float d1, float d2) { return max(-d1, d2); }

// Sigil definitions (static versions)
float fireSigil(vec2 p) {
    p.y -= 0.1; float finalShape = 1.0;
    for(int i = 0; i < 3; i++) {
        float angle = (float(i) / 3.0) * (2.0 * PI);
        vec2 rp = p * rotate2d(angle); rp.y -= 0.35;
        float flame = opUnion(opUnion(circleSDF(rp, 0.08), boxSDF(rp - vec2(0.0, 0.1), vec2(0.02, 0.1))), circleSDF(rp - vec2(0.0, 0.25), 0.03));
        finalShape = opUnion(finalShape, flame);
    }
    return finalShape;
}
float waterSigil(vec2 p) {
    float wave1 = p.y + sin(p.x * 5.0) * 0.1 - 0.2;
    float wave2 = p.y + cos(p.x * 4.0) * 0.1;
    float wave3 = p.y + sin(p.x * 6.0) * 0.1 + 0.2;
    float d = 1.0; d = opUnion(d, abs(wave1) - 0.02); d = opUnion(d, abs(wave2) - 0.02); d = opUnion(d, abs(wave3) - 0.02);
    d = max(d, abs(p.x) - 0.4); d = max(d, abs(p.y) - 0.4);
    return d;
}
float airSigil(vec2 p) {
    float d = 1.0;
    for(int i = 0; i < 5; i++) {
        float fi = float(i); float t = fi * 0.5; vec2 lp = p * rotate2d(t * 2.0);
        lp.x -= (sin(t) + 1.0) * 0.2;
        d = opUnion(d, boxSDF(lp, vec2(0.2, 0.01)));
    }
    return d;
}
float earthSigil(vec2 p) { return opSubtraction(opSubtraction(boxSDF(p, vec2(0.25, 0.25)), circleSDF(p, 0.15)), boxSDF(abs(p) - 0.25, vec2(0.05))); }
float utilitySigil(vec2 p) {
    float d = 1.0;
    for(int i=0; i<6; i++) { d = opUnion(d, lineSDF(p * rotate2d(float(i) * PI / 3.0), vec2(0.0), vec2(0.3, 0.0)) - 0.02); }
    return opSubtraction(d, circleSDF(p, 0.15));
}

void main() {
    vec2 p = vUv * 2.0 - 1.0; // Remap UV from [0,1] to [-1,1]
    
    float d;
    if (uElementId == 0) d = fireSigil(p);
    else if (uElementId == 1) d = waterSigil(p);
    else if (uElementId == 2) d = airSigil(p);
    else if (uElementId == 3) d = earthSigil(p);
    else if (uElementId == 4) d = utilitySigil(p);
    else discard; // If no valid ID, pixel is transparent

    float alpha = 1.0 - smoothstep(-0.02, 0.02, d);
    
    if (alpha < 0.01) {
        discard;
    }

    gl_FragColor = vec4(uElementColor, alpha);
}