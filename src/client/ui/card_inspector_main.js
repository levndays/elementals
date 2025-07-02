import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LoadoutManager } from './LoadoutManager.js';
import { CardObject } from '../rendering/CardObject.js';
import { CardParticleSystem } from '../rendering/CardParticleSystem.js';

class CardInspectorApp {
    constructor() {
        this.manager = new LoadoutManager();
        this.canvas = document.getElementById('inspector-canvas');
        this.scene = new THREE.Scene();
        this.backgroundScene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 100);
        this.backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.clock = new THREE.Clock();
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.activeCardObject = null;
        this.particleSystem = null;
        this.godRayPlane = null;
        this.elements = {
            title: document.getElementById('card-name-title'),
            exitBtn: document.getElementById('exit-btn'),
            prompt: document.getElementById('inspector-prompt'),
        };
    }

    async init() {
        await this.manager.init();
        this.renderer.setSize(this.canvas.parentElement.clientWidth, this.canvas.parentElement.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.camera.position.set(0, 0, 3.5);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
        keyLight.position.set(2, 3, 3);
        this.scene.add(keyLight);

        this.controls.enableDamping = true;
        this.controls.enablePan = false;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 6;
        this.controls.target.set(0, 0, 0);

        this.setupEventListeners();
        window.addEventListener('resize', () => this.onResize());

        const urlParams = new URLSearchParams(window.location.search);
        const cardId = urlParams.get('id');

        if (cardId) {
            const cardData = this.manager.getCardDetails(cardId);
            if (cardData) {
                this.elements.title.textContent = cardData.name;
                await this.displayCard(cardData);
            } else {
                this.elements.prompt.textContent = 'Card not found.';
            }
        } else {
            this.elements.prompt.textContent = 'No card specified.';
        }

        this.animate();
    }

    createGodRayPlane(color) {
        if (this.godRayPlane) {
            this.backgroundScene.remove(this.godRayPlane);
            this.godRayPlane.geometry.dispose();
            if(this.godRayPlane.material.map) this.godRayPlane.material.map.dispose();
            this.godRayPlane.material.dispose();
        }

        const canvas = document.createElement('canvas');
        const size = 512;
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const centerX = size / 2, centerY = size / 2;
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size / 2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1.5;
        for(let i=0; i < 100; i++) {
            const angle = Math.random() * Math.PI * 2;
            const length = size * 0.4 + (Math.random() * size * 0.3);
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + Math.cos(angle) * length, centerY + Math.sin(angle) * length);
            ctx.stroke();
        }
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({ map: texture, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
        this.godRayPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        this.backgroundScene.add(this.godRayPlane);
    }
    
    async displayCard(cardData) {
        if (this.activeCardObject) {
            this.activeCardObject.dispose();
            this.scene.remove(this.activeCardObject.mesh);
        }
        if (this.particleSystem) this.particleSystem.dispose();
        
        this.activeCardObject = await CardObject.create(cardData);
        this.scene.add(this.activeCardObject.mesh);
        this.particleSystem = new CardParticleSystem(this.scene, cardData.element);
        const elementColors = { Fire: '#FF771A', Water: '#00A3FF', Air: '#B3FCFC', Earth: '#B39159', Utility: '#A16BFF' };
        this.createGodRayPlane(elementColors[cardData.element] || '#FFFFFF');
        this.elements.prompt.style.opacity = '0';
    }

    setupEventListeners() {
        this.elements.exitBtn.onclick = () => { window.location.href = 'loadout.html'; };
    }

    onResize() {
        const { clientWidth, clientHeight } = this.canvas.parentElement;
        this.camera.aspect = clientWidth / clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(clientWidth, clientHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        const deltaTime = this.clock.getDelta();
        
        this.controls.update();
        if (this.activeCardObject) this.activeCardObject.update(deltaTime);
        if (this.particleSystem) this.particleSystem.update(deltaTime);
        if (this.godRayPlane) this.godRayPlane.rotation.z += 0.001;
        
        this.renderer.autoClear = false;
        this.renderer.clear();
        this.renderer.render(this.backgroundScene, this.backgroundCamera);
        this.renderer.clearDepth();
        this.renderer.render(this.scene, this.camera);
    }
}

const app = new CardInspectorApp();
app.init().catch(err => {
    console.error("Failed to initialize Card Inspector:", err);
    document.getElementById('inspector-prompt').textContent = 'Error loading. See console.';
});