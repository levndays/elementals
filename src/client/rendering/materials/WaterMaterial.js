// src/client/rendering/materials/WaterMaterial.js
import * as THREE from 'three';
import { ShaderLib } from '../shaders/ShaderLib.js';

let _noiseShader = null;

export class WaterMaterial extends THREE.MeshPhongMaterial {
    constructor(options = {}) {
        if (!_noiseShader) {
            throw new Error('WaterMaterial.init() must be called before instantiation.');
        }

        super({
            color: 0x9bd8ff,
            transparent: true,
            opacity: 0.85,
            shininess: 90,
            specular: 0x888888,
            ...options
        });

        this.customUniforms = {
            uTime: { value: 0 },
            uBigWavesElevation: { value: 0.1 },
            uBigWavesFrequency: { value: new THREE.Vector2(2, 1.0) },
            uBigWavesSpeed: { value: 0.5 },
            uSmallWavesElevation: { value: 0.05 },
            uSmallWavesFrequency: { value: 3.0 },
            uSmallWavesIterations: { value: 3.0 },
            uSmallWavesSpeed: { value: 0.2 },
            uColorOffset: { value: 0.08 },
            uColorMultiplier: { value: 5.0 },
            uDepthColor: { value: new THREE.Color(0x001e0f) },
            uSurfaceColor: { value: new THREE.Color(0x9bd8ff) },
        };

        this.onBeforeCompile = (shader) => {
            shader.uniforms = { ...shader.uniforms, ...this.customUniforms };

            shader.vertexShader = _noiseShader + '\n' + shader.vertexShader;
            
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `
                #include <common>
                uniform float uTime;
                uniform float uBigWavesElevation;
                uniform vec2 uBigWavesFrequency;
                uniform float uBigWavesSpeed;
                uniform float uSmallWavesElevation;
                uniform float uSmallWavesFrequency;
                uniform float uSmallWavesSpeed;
                uniform float uSmallWavesIterations;
                varying float vElevation;
                `
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>

                // --- Custom Water Logic START ---
                vec4 worldPosition_local = modelMatrix * vec4(position, 1.0);

                // Big waves
                float bigWaveX = cnoise(vec2(worldPosition_local.x * uBigWavesFrequency.x * 0.5, uTime * uBigWavesSpeed));
                float bigWaveZ = cnoise(vec2(worldPosition_local.z * uBigWavesFrequency.y * 0.5, uTime * uBigWavesSpeed));
                float elevation = (bigWaveX + bigWaveZ) * 0.5 * uBigWavesElevation;

                // Small waves
                float smallWaves = 0.0;
                float frequency = uSmallWavesFrequency;
                float amplitude = uSmallWavesElevation;
                for(float i = 0.0; i < uSmallWavesIterations; i++) {
                    smallWaves += sin(dot(normalize(vec2(cos(i * 1.3), sin(i * 1.3))), worldPosition_local.xz) * frequency + uTime * uSmallWavesSpeed * (i+1.0)*0.5) * amplitude;
                    frequency *= 1.8;
                    amplitude *= 0.6;
                }
                elevation += smallWaves;
                vElevation = elevation;

                transformed.y += elevation;
                // --- Custom Water Logic END ---
                `
            );
            
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `
                #include <common>
                uniform float uTime;
                uniform float uColorOffset;
                uniform float uColorMultiplier;
                uniform vec3 uDepthColor;
                uniform vec3 uSurfaceColor;
                varying float vElevation;
                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `
                #include <dithering_fragment>

                // Fresnel calculation
                float fresnel = pow(1.0 - abs(dot(normalize(vViewPosition), vNormal)), 3.0);
                
                // Mix water color with specular highlights based on fresnel
                gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), fresnel);
                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                'vec4 diffuseColor = vec4( diffuse, opacity );',
                `
                float mixStrength = (vElevation + uColorOffset) * uColorMultiplier;
                vec3 waterColor = mix(uDepthColor, uSurfaceColor, mixStrength);
                vec4 diffuseColor = vec4(waterColor, opacity);
                `
            );
        };
    }

    set time(value) {
        if (this.customUniforms) {
            this.customUniforms.uTime.value = value;
        }
    }

    get time() {
        return this.customUniforms?.uTime.value || 0;
    }

    static async init() {
        if (_noiseShader) return;
        _noiseShader = ShaderLib.noise;
    }
}