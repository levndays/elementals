uniform sampler2D uTexture;
uniform vec3 uColor;

varying float vAlpha;

void main() {
    if (vAlpha <= 0.0) discard;

    vec4 texColor = texture2D(uTexture, gl_PointCoord);
    if (texColor.a < 0.1) discard;

    gl_FragColor = vec4(uColor, vAlpha * texColor.a);
}