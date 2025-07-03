// src/client/ui/LoadoutUI.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CardObject } from '../rendering/CardObject.js';
import { CardParticleSystem } from '../rendering/CardParticleSystem.js';
import { WeaponFactory } from '../../game/weapons/WeaponFactory.js';

export class LoadoutUI {
    constructor(manager, abilityIconService) {
        this.manager = manager;
        this.abilityIconService = abilityIconService;
        this.elements = {
            inventoryPanel: document.getElementById('inventory-panel'),
            inventoryGrid: document.getElementById('inventory-grid'),
            
            playerPanel: document.getElementById('player-panel'),
            playerPreviewCanvas: document.getElementById('player-preview-canvas'),
            equippedSlotsContainer: document.getElementById('equipped-slots-container'),
            equippedSlots: document.querySelectorAll('.equipped-slot'),
            
            synergyName: document.getElementById('synergy-name'),
            synergyDescription: document.getElementById('synergy-description'),
            synergyDisplay: document.getElementById('synergy-display'),

            cardDetailsPanel: document.getElementById('card-details-panel'),
            detailsView2D: document.getElementById('details-view-2d'),
            detailsName: document.getElementById('details-name'),
            detailsElementTier: document.getElementById('details-element-tier'),
            detailsCost: document.getElementById('details-cost'),
            detailsCooldown: document.getElementById('details-cooldown'),
            detailsDescription: document.getElementById('details-description'),
            detailsFlavor: document.getElementById('details-flavor-text'),
            inspectBtn: document.getElementById('inspect-card-btn'),

            inspectorModal: document.getElementById('inspector-modal'),
            inspectionCanvas: document.getElementById('inspection-canvas'),
            inspectorModalCloseBtn: document.getElementById('inspector-modal-close-btn'),

            loadoutSelect: document.getElementById('loadout-select-dropdown'),
            loadoutNameInput: document.getElementById('loadout-name-input'),
            saveBtn: document.getElementById('save-loadout-btn'),
            backBtn: document.getElementById('back-to-menu-btn'),
            playBtn: document.getElementById('play-game-btn'),
        };
        this.selectedCardForInspect = null;

        this.inspector = {
            isActive: false,
            clock: new THREE.Clock(),
            scene: null, camera: null, renderer: null, controls: null,
            backgroundScene: null, backgroundCamera: null,
            activeMesh: null,
            activeCardObject: null, 
            particleSystem: null, 
            godRayPlane: null,
            tierLight: null,
            resizeObserver: null,
        };
    }

    init() {
        this.initPlayerPreview();
        this.initCardInspector();
        this.renderInventory();
        this.renderLoadout();
        this.renderLoadoutSelector();
        this.bindEventListeners();
    }

    initPlayerPreview() {
        const canvas = this.elements.playerPreviewCanvas;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        camera.position.z = 3;
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 2, 3);
        scene.add(directionalLight);
        const playerGeo = new THREE.CapsuleGeometry(0.5, 1.0, 4, 8);
        const playerMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5 });
        const playerMesh = new THREE.Mesh(playerGeo, playerMat);
        playerMesh.position.y = -0.5;
        scene.add(playerMesh);

        const onResize = () => {
            if (!canvas.parentElement) return;
            const { clientWidth, clientHeight } = canvas.parentElement;
            renderer.setSize(clientWidth, clientHeight);
            camera.aspect = clientWidth / clientHeight;
            camera.updateProjectionMatrix();
        };
        onResize();
        new ResizeObserver(onResize).observe(canvas.parentElement);
        const animate = () => {
            requestAnimationFrame(animate);
            playerMesh.rotation.y += 0.005;
            renderer.render(scene, camera);
        };
        animate();
    }

    initCardInspector() {
        const canvas = this.elements.inspectionCanvas;
        this.inspector.scene = new THREE.Scene();
        this.inspector.backgroundScene = new THREE.Scene();
        this.inspector.camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
        this.inspector.backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.inspector.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        this.inspector.renderer.setPixelRatio(window.devicePixelRatio);
        this.inspector.renderer.autoClear = false;

        this.inspector.camera.position.set(0, 0, 3.5);
        this.inspector.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
        keyLight.position.set(2, 3, 3);
        this.inspector.scene.add(keyLight);

        this.inspector.controls = new OrbitControls(this.inspector.camera, this.inspector.renderer.domElement);
        this.inspector.controls.enableDamping = true;
        this.inspector.controls.enablePan = false;
        this.inspector.controls.minDistance = 2;
        this.inspector.controls.maxDistance = 6;
        
        this._animateInspector();
    }

    _animateInspector() {
        requestAnimationFrame(() => this._animateInspector());
        if (!this.inspector.isActive) return;

        const deltaTime = this.inspector.clock.getDelta();
        this.inspector.controls.update();
        this.inspector.activeCardObject?.update(deltaTime);
        this.inspector.particleSystem?.update(deltaTime);
        if (this.inspector.godRayPlane) this.inspector.godRayPlane.rotation.z += 0.001;

        const { renderer, backgroundScene, backgroundCamera, scene, camera } = this.inspector;
        renderer.clear();
        renderer.render(backgroundScene, backgroundCamera);
        renderer.clearDepth();
        renderer.render(scene, camera);
    }
    
    async showInspectorView(cardId) {
        if (!cardId) return;
        const cardData = this.manager.getCardDetails(cardId);
        if (!cardData) return;

        this._cleanupInspectorAssets();
        
        const tierColors = {
            1: new THREE.Color(0x3399ff),
            2: new THREE.Color(0xcc66ff),
            3: new THREE.Color(0xff6633),
            default: new THREE.Color(0xffffff)
        };
        const tierColor = tierColors[cardData.tier] || tierColors.default;

        if (cardData.type === 'Weapon') {
            const weapon = WeaponFactory.create(cardId);
            if (weapon?.mesh) {
                this.inspector.activeMesh = weapon.mesh;
            }
        } else {
            this.inspector.activeCardObject = await CardObject.create(cardData);
            this.inspector.activeMesh = this.inspector.activeCardObject.mesh;
            this.inspector.particleSystem = new CardParticleSystem(this.inspector.scene, cardData.element);
        }
        
        if (this.inspector.activeMesh) {
            this.inspector.scene.add(this.inspector.activeMesh);
        }

        this._createGodRayPlane(tierColor);
        this.inspector.tierLight = new THREE.PointLight(tierColor, 10, 20, 1.5);
        this.inspector.tierLight.position.set(0, 0, -4);
        this.inspector.scene.add(this.inspector.tierLight);
        
        this.elements.inspectorModal.classList.add('active');
        this.inspector.isActive = true;

        const canvas = this.elements.inspectionCanvas;
        const { clientWidth, clientHeight } = canvas.parentElement;
        this.inspector.renderer.setSize(clientWidth, clientHeight);
        this.inspector.camera.aspect = clientWidth / clientHeight;
        this.inspector.camera.updateProjectionMatrix();

        if (!this.inspector.resizeObserver) {
            const onResize = () => {
                if (!this.inspector.isActive || !canvas.parentElement) return;
                const { clientWidth, clientHeight } = canvas.parentElement;
                this.inspector.renderer.setSize(clientWidth, clientHeight);
                this.inspector.camera.aspect = clientWidth / clientHeight;
                this.inspector.camera.updateProjectionMatrix();
            };
            this.inspector.resizeObserver = new ResizeObserver(onResize);
            this.inspector.resizeObserver.observe(canvas.parentElement);
        }
    }

    hideInspectorView() {
        this.inspector.isActive = false;
        this._cleanupInspectorAssets();
        this.elements.inspectorModal.classList.remove('active');

        if (this.inspector.resizeObserver) {
            this.inspector.resizeObserver.disconnect();
            this.inspector.resizeObserver = null;
        }
    }

    _cleanupInspectorAssets() {
        if (this.inspector.activeMesh) {
            this.inspector.scene.remove(this.inspector.activeMesh);
            this.inspector.activeMesh = null;
        }
        if (this.inspector.activeCardObject) {
            this.inspector.activeCardObject.dispose();
            this.inspector.activeCardObject = null;
        }
        if (this.inspector.particleSystem) {
            this.inspector.particleSystem.dispose();
            this.inspector.particleSystem = null;
        }
        if (this.inspector.godRayPlane) {
             this.inspector.backgroundScene.remove(this.inspector.godRayPlane);
             this.inspector.godRayPlane.geometry.dispose();
             this.inspector.godRayPlane.material.map?.dispose();
             this.inspector.godRayPlane.material.dispose();
             this.inspector.godRayPlane = null;
        }
        if (this.inspector.tierLight) {
            this.inspector.scene.remove(this.inspector.tierLight);
            this.inspector.tierLight.dispose();
            this.inspector.tierLight = null;
        }
    }

    _createGodRayPlane(color) {
        if (this.inspector.godRayPlane) {
            this.inspector.backgroundScene.remove(this.inspector.godRayPlane);
            this.inspector.godRayPlane.geometry.dispose();
            this.inspector.godRayPlane.material.map?.dispose();
            this.inspector.godRayPlane.material.dispose();
        }

        const canvas = document.createElement('canvas');
        const size = 512;
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d'), centerX = size / 2, centerY = size / 2;
        
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
        this.inspector.godRayPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        this.inspector.backgroundScene.add(this.inspector.godRayPlane);
    }
    
    renderInventory() {
        this.elements.inventoryGrid.innerHTML = '';
        const inventoryItems = this.manager.getInventoryItems('all');
        inventoryItems.forEach(item => {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.appendChild(this.createCardElement(item));
            this.elements.inventoryGrid.appendChild(slot);
        });
    }

    renderLoadout() {
        const loadoutCards = this.manager.getActiveLoadoutCards();
        const equippedWeapon = this.manager.getActiveWeapon();

        this.elements.equippedSlots.forEach((slot) => {
            slot.innerHTML = '';
            const slotType = slot.dataset.slotType;
            if (slotType === 'ability') {
                const index = parseInt(slot.dataset.slotIndex, 10);
                const card = loadoutCards[index];
                if (card) slot.appendChild(this.createCardElement(card));
            } else if (slotType === 'weapon') {
                if (equippedWeapon) slot.appendChild(this.createCardElement(equippedWeapon));
            }
        });
        this.renderSynergy();
    }

    renderSynergy() {
        const { isValid, synergyName, description } = this.manager.currentSynergy;
        this.elements.synergyName.textContent = synergyName;
        this.elements.synergyDescription.textContent = description;
        this.elements.synergyDisplay.className = 'synergy-display ' + (isValid ? 'synergy-valid' : 'synergy-invalid');
        this.elements.playBtn.disabled = false;
    }

    renderLoadoutSelector() {
        this.elements.loadoutSelect.innerHTML = '';
        Object.keys(this.manager.playerProfile.savedLoadouts).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            this.elements.loadoutSelect.appendChild(option);
        });
        this.elements.loadoutSelect.value = this.manager.activeLoadout.name;
        this.elements.loadoutNameInput.value = this.manager.activeLoadout.name;
    }

    createCardElement(cardData) {
        const el = document.createElement('div');
        el.className = `card-item element-${cardData.element.toLowerCase()} tier-${cardData.tier}`;
        el.draggable = true;
        el.dataset.cardId = cardData.id;
        el.dataset.cardType = cardData.type || 'Ability';

        const iconContainer = document.createElement('div');
        iconContainer.className = 'card-item-icon';
        el.appendChild(iconContainer);
        
        this.abilityIconService.generate(cardData).then(iconUrl => {
            if (iconUrl) iconContainer.style.backgroundImage = `url(${iconUrl})`;
        }).catch(err => console.error(`Failed to generate icon for ${cardData.name}:`, err));

        const textWrapper = document.createElement('div');
        textWrapper.className = 'card-item-text';
        textWrapper.innerHTML = `
            <span class="card-item-name">${cardData.name}</span>
            <span class="card-item-type">${cardData.type}</span>
        `;
        el.appendChild(textWrapper);
        
        el.onclick = (e) => {
            e.stopPropagation();
            this.selectForInspect(cardData.id);
        };
        return el;
    }
    
    selectForInspect(cardId) {
        document.querySelectorAll('.card-item.selected').forEach(el => el.classList.remove('selected'));
        if (!cardId) {
            this.selectedCardForInspect = null;
            this.elements.inspectBtn.disabled = true;
            this.renderCardDetails(null);
            return;
        }

        const cardData = this.manager.getCardDetails(cardId);
        this.renderCardDetails(cardData);
        
        document.querySelectorAll(`.card-item[data-card-id="${cardId}"]`).forEach(el => el.classList.add('selected'));
        
        this.selectedCardForInspect = cardId;
        this.elements.inspectBtn.disabled = false;
    }

    renderCardDetails(card) {
        if (card) {
            this.elements.detailsName.textContent = card.name;
            this.elements.detailsElementTier.textContent = `${card.element} - Tier ${card.tier}`;
            this.elements.detailsCost.textContent = card.energyCost ? `Cost: ${card.energyCost}` : '';
            this.elements.detailsCooldown.textContent = card.cooldown ? `CD: ${card.cooldown}s` : '';
            this.elements.detailsDescription.textContent = card.description;
            this.elements.detailsFlavor.textContent = `"${card.flavor}"`;
        } else {
            this.elements.detailsName.textContent = 'SELECT A CARD';
            this.elements.detailsElementTier.textContent = 'Click a card to see its details.';
            this.elements.detailsCost.textContent = '';
            this.elements.detailsCooldown.textContent = '';
            this.elements.detailsDescription.textContent = '';
            this.elements.detailsFlavor.textContent = '';
        }
    }

    bindEventListeners() {
        this.elements.inspectBtn.onclick = () => this.showInspectorView(this.selectedCardForInspect);
        this.elements.inspectorModalCloseBtn.onclick = () => this.hideInspectorView();
        this.elements.inspectorModal.onclick = (e) => {
            if (e.target === this.elements.inspectorModal) this.hideInspectorView();
        };

        let draggedElement = null;
        document.body.addEventListener('dragstart', e => {
            if (e.target.matches('.card-item')) {
                draggedElement = e.target;
                setTimeout(() => e.target.classList.add('dragging'), 0);
                const data = { cardId: e.target.dataset.cardId, cardType: e.target.dataset.cardType };
                const sourceSlotEl = e.target.closest('.equipped-slot');
                if (sourceSlotEl) data.sourceType = sourceSlotEl.dataset.slotType;
                if (sourceSlotEl?.dataset.slotIndex) data.sourceIndex = sourceSlotEl.dataset.slotIndex;
                e.dataTransfer.setData('application/json', JSON.stringify(data));
                e.dataTransfer.effectAllowed = 'move';
            }
        });
        document.body.addEventListener('dragend', () => {
            draggedElement?.classList.remove('dragging');
            draggedElement = null;
            this.elements.inventoryPanel.classList.remove('inventory-drag-over');
        });

        this.elements.equippedSlots.forEach(slot => {
            slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag-over'); });
            slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
            slot.addEventListener('drop', e => {
                e.preventDefault();
                slot.classList.remove('drag-over');
                try {
                    const data = JSON.parse(e.dataTransfer.getData('application/json'));
                    if (!data.cardId) return;

                    const targetSlotType = slot.dataset.slotType;
                    if (data.cardType.toLowerCase() !== targetSlotType) return;

                    if (targetSlotType === 'weapon') {
                        this.manager.equipWeapon(data.cardId);
                    } else if (targetSlotType === 'ability') {
                        const targetIndex = parseInt(slot.dataset.slotIndex, 10);
                        if (data.sourceType === 'ability') {
                            const sourceIndex = parseInt(data.sourceIndex, 10);
                            this.manager.swapCards(sourceIndex, targetIndex);
                        } else {
                            this.manager.equipCard(data.cardId, targetIndex);
                        }
                    }
                    this.renderLoadout();
                    this.renderInventory();
                } catch (err) { console.warn("Drop on slot failed.", err); }
            });
        });

        const inventoryPanel = this.elements.inventoryPanel;
        inventoryPanel.addEventListener('dragover', e => {
            e.preventDefault();
            inventoryPanel.classList.add('inventory-drag-over');
        });
        inventoryPanel.addEventListener('dragleave', () => inventoryPanel.classList.remove('inventory-drag-over'));
        inventoryPanel.addEventListener('drop', e => {
            e.preventDefault();
            inventoryPanel.classList.remove('inventory-drag-over');
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                if (data.sourceType === 'ability') {
                    this.manager.unequipCard(parseInt(data.sourceIndex, 10));
                } else if (data.sourceType === 'weapon') {
                    this.manager.unequipWeapon();
                }
                this.renderLoadout();
                this.renderInventory();
            } catch (err) { console.warn("Drop on inventory failed.", err); }
        });

        this.elements.saveBtn.onclick = () => { this.manager.saveActiveLoadout(this.elements.loadoutNameInput.value); this.renderLoadoutSelector(); };
        this.elements.loadoutSelect.onchange = (e) => { this.manager.switchActiveLoadout(e.target.value); this.elements.loadoutNameInput.value = e.target.value; this.renderLoadout(); this.renderInventory(); };
        this.elements.backBtn.onclick = () => window.location.href = 'index.html';
        this.elements.playBtn.onclick = () => { this.manager.saveActiveLoadoutToLocalStorage(); window.location.href = 'index.html?showLevelSelect=true'; };
        document.body.addEventListener('click', () => { if(!this.inspector.isActive) this.selectForInspect(null); });
    }
}