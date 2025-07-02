import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ShaderLib } from './shaders/ShaderLib.js';

export class CardObject {
    constructor(cardData, faceMaterial, backMaterial) {
        this.cardData = cardData;
        this.faceMaterial = faceMaterial;
        this.backMaterial = backMaterial;

        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.2 });
        const geometry = new RoundedBoxGeometry(1.25, 1.75, 0.02, 5, 0.04);
        this.mesh = new THREE.Mesh(geometry, [
            bodyMaterial, bodyMaterial, bodyMaterial, bodyMaterial,
            this.faceMaterial, this.backMaterial,
        ]);
    }

    static async create(cardData) {
        const [
            vertexShader, fragShaderSource, backVertexShader, backFragmentShader
        ] = await Promise.all([
            fetch('./src/client/rendering/shaders/card.vert').then(res => res.text()),
            fetch('./src/client/rendering/shaders/card.frag').then(res => res.text()),
            fetch('./src/client/rendering/shaders/card_back.vert').then(res => res.text()),
            fetch('./src/client/rendering/shaders/card_back.frag').then(res => res.text())
        ]);
        
        const finalFragmentShader = ShaderLib.noise + '\n' + fragShaderSource;
        const finalBackFragmentShader = ShaderLib.noise + '\n' + backFragmentShader;
        
        const elementMap = { Fire: 0, Water: 1, Air: 2, Earth: 3, Utility: 4 };
        const elementColors = { Fire: new THREE.Color('#FF771A'), Water: new THREE.Color('#00A3FF'), Air: new THREE.Color('#B3FCFC'), Earth: new THREE.Color('#B39159'), Utility: new THREE.Color('#A16BFF'), Default: new THREE.Color('#FFFFFF')};

        const elementId = elementMap[cardData.element] ?? 5;
        const elementColor = elementColors[cardData.element] || elementColors.Default;
        const textTexture = new THREE.CanvasTexture(await this.createTextCanvas(cardData));
        textTexture.wrapS = THREE.ClampToEdgeWrapping;
        textTexture.wrapT = THREE.ClampToEdgeWrapping;

        const faceMaterial = new THREE.ShaderMaterial({ vertexShader, fragmentShader: finalFragmentShader, uniforms: { uTime: { value: 0 }, uElementColor: { value: elementColor }, uElementId: { value: elementId }, uTextTexture: { value: textTexture }}, transparent: true });
        const backMaterial = new THREE.ShaderMaterial({ vertexShader: backVertexShader, fragmentShader: finalBackFragmentShader, uniforms: { uTime: { value: 0 }, uElementColor: { value: elementColor }} });
        
        return new CardObject(cardData, faceMaterial, backMaterial);
    }

    static async createTextCanvas(cardData) {
        const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'), w = 512, h = 717;
        canvas.width = w; canvas.height = h;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.textAlign = 'center';
        ctx.font = 'bold 50px Poppins'; ctx.textBaseline = 'top'; ctx.fillText(cardData.name, w / 2, 50);
        ctx.textAlign = 'left';
        
        // REWORK: Reduced font size and line height for description
        ctx.font = '26px Poppins';
        this.wrapText(ctx, cardData.description || '', 60, 480, 400, 32);

        ctx.font = 'bold 32px Poppins'; ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        const statsY = 620;
        this.drawLightningIcon(ctx, 60, statsY + 16);
        ctx.fillText(cardData.energyCost || '0', 90, statsY);
        this.drawClockIcon(ctx, w - 140, statsY + 16);
        ctx.textAlign = 'right';
        ctx.fillText(`${cardData.cooldown || '0'}s`, w - 60, statsY);
        return canvas;
    }

    static wrapText(ctx, text, x, y, maxW, lineH) {
        const words = text.split(' '); let line = '';
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            if (ctx.measureText(testLine).width > maxW && n > 0) {
                ctx.fillText(line, x, y); line = words[n] + ' '; y += lineH;
            } else { line = testLine; }
        }
        ctx.fillText(line, x, y);
    }

    static drawLightningIcon(ctx, x, y) {
        ctx.save(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(x + 6, y - 12); ctx.lineTo(x - 2, y); ctx.lineTo(x + 4, y); ctx.lineTo(x - 4, y + 12);
        ctx.stroke(); ctx.restore();
    }

    static drawClockIcon(ctx, x, y) {
        ctx.save(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.moveTo(x, y); ctx.lineTo(x, y - 6); ctx.moveTo(x, y); ctx.lineTo(x + 4, y);
        ctx.stroke(); ctx.restore();
    }
    
    update(deltaTime) {
        if (this.faceMaterial) this.faceMaterial.uniforms.uTime.value += deltaTime;
        if (this.backMaterial) this.backMaterial.uniforms.uTime.value += deltaTime;
    }

    dispose() {
        this.mesh.geometry.dispose();
        if (this.faceMaterial) {
            this.faceMaterial.uniforms.uTextTexture.value?.dispose();
            this.faceMaterial.dispose();
        }
        this.backMaterial?.dispose();
    }
}