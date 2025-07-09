import * as THREE from 'three';
import { StateChangeCommand } from './UndoManager.js';

export class ModelEditorUI {
    constructor(app) {
        this.app = app;
        this.outlinerContent = document.getElementById('outliner-content');
        this.inspectorContent = document.getElementById('inspector-content');
        this.draggedElement = null;
        this.init();
    }

    init() {
        // --- Menu ---
        document.getElementById('menu-file-exit').onclick = () => { window.location.href = 'index.html'; };
        document.getElementById('menu-file-test').onclick = () => this.onTestAsset();
        document.getElementById('menu-edit-delete').onclick = () => this.app.actions.deleteSelected();
        document.getElementById('menu-edit-undo').onclick = () => this.app.undoManager.undo();
        document.getElementById('menu-edit-redo').onclick = () => this.app.undoManager.redo();

        // --- Toolbar ---
        document.getElementById('tool-translate').onclick = () => this.app.controls.setMode('translate');
        document.getElementById('tool-rotate').onclick = () => this.app.controls.setMode('rotate');
        document.getElementById('tool-scale').onclick = () => this.app.controls.setMode('scale');
        
        const snapToggle = document.getElementById('snap-toggle');
        const transSnapInput = document.getElementById('snap-translation-input');
        const rotSnapInput = document.getElementById('snap-rotation-input');
        snapToggle.onchange = (e) => this.app.controls.setSnapEnabled(e.target.checked);
        transSnapInput.onchange = (e) => this.app.controls.setTranslationSnap(parseFloat(e.target.value));
        rotSnapInput.onchange = (e) => this.app.controls.setRotationSnap(parseFloat(e.target.value));
        document.querySelector('label[for="snap-toggle"]').onclick = () => snapToggle.click();
        
        // Set initial UI values from controls state
        snapToggle.checked = this.app.controls.isSnapEnabled;
        transSnapInput.value = this.app.controls.translationSnapValue;
        rotSnapInput.value = this.app.controls.rotationSnapValue;

        // --- Create Button & Menu ---
        const createButton = document.getElementById('create-button');
        const createMenu = document.getElementById('create-context-menu');
        createButton.onclick = (e) => { e.stopPropagation(); createMenu.style.display = createMenu.style.display === 'none' ? 'flex' : 'none'; };
        createMenu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action && typeof this.app.actions[action] === 'function') this.app.actions[action]();
            createMenu.style.display = 'none';
        });
        document.addEventListener('click', () => { createMenu.style.display = 'none'; });
        
        // --- Outliner ---
        this.outlinerContent.addEventListener('click', (e) => this.handleOutlinerClick(e));
        this.outlinerContent.addEventListener('dragstart', (e) => this.handleOutlinerDragStart(e));
        this.outlinerContent.addEventListener('dragover', (e) => this.handleOutlinerDragOver(e));
        this.outlinerContent.addEventListener('dragleave', (e) => this.handleOutlinerDragLeave(e));
        this.outlinerContent.addEventListener('drop', (e) => this.handleOutlinerDrop(e));
    }
    
    updateOnSelectionChange() {
        document.getElementById('menu-edit-delete').disabled = this.app.selectedObjects.size === 0;
        this.updateOutliner();
        this.updateInspector();
    }

    handleOutlinerClick(event) {
        const item = event.target.closest('.outliner-item');
        if (!item) return;

        const object = this.app.assetContext.parts.get(item.dataset.uuid);
        if (!object) return;

        if (event.shiftKey) {
            if (this.app.selectedObjects.has(object)) {
                this.app.removeFromSelection(object);
            } else {
                this.app.addToSelection(object);
            }
        } else {
            this.app.select(object);
        }
    }

    handleOutlinerDragStart(event) {
        const item = event.target.closest('.outliner-item');
        if (!item) return;
        this.draggedElement = item;
        event.dataTransfer.setData('text/plain', item.dataset.uuid);
        event.dataTransfer.effectAllowed = 'move';
    }
    
    handleOutlinerDragOver(event) {
        event.preventDefault();
        const targetItem = event.target.closest('.outliner-item');
        if (targetItem && targetItem !== this.draggedElement) {
            targetItem.classList.add('drag-over');
        }
    }

    handleOutlinerDragLeave(event) {
        const targetItem = event.target.closest('.outliner-item');
        if (targetItem) {
            targetItem.classList.remove('drag-over');
        }
    }

    handleOutlinerDrop(event) {
        event.preventDefault();
        const targetItem = event.target.closest('.outliner-item');
        if (targetItem) targetItem.classList.remove('drag-over');
        
        const draggedUuid = event.dataTransfer.getData('text/plain');
        const targetUuid = targetItem ? targetItem.dataset.uuid : null;

        if (draggedUuid && draggedUuid !== targetUuid) {
            this.app.actions.reparentPart(draggedUuid, targetUuid);
        }
        this.draggedElement = null;
    }

    updateOutliner() {
        this.outlinerContent.innerHTML = '';
        if (this.app.assetContext.parts.size === 0) {
            this.outlinerContent.innerHTML = '<div class="placeholder-text">Create a part to begin.</div>';
            return;
        }

        const buildTree = (parent, level) => {
            parent.children.forEach(child => {
                if (!this.app.assetContext.parts.has(child.uuid)) return; // Skip children that aren't in the context (like gizmos)
                const item = document.createElement('div');
                item.className = 'outliner-item';
                item.textContent = child.name;
                item.dataset.uuid = child.uuid;
                item.dataset.depth = level;
                item.draggable = true;
                if (this.app.selectedObjects.has(child)) item.classList.add('selected');
                this.outlinerContent.appendChild(item);
                buildTree(child, level + 1);
            });
        };
        buildTree(this.app.assetContext.assetRoot, 0);
    }

    updateInspector() {
        this.inspectorContent.innerHTML = '';
        const obj = this.app.primarySelectedObject;

        if (this.app.selectedObjects.size > 1) {
             const multiSelectInfo = document.createElement('div');
            multiSelectInfo.className = 'placeholder-text';
            multiSelectInfo.innerHTML = `<b>${this.app.selectedObjects.size} objects selected.</b><br>Properties shown for primary selection.`;
            this.inspectorContent.appendChild(multiSelectInfo);
        }

        if (!obj) {
            this.inspectorContent.innerHTML = '<div class="placeholder-text">Select a part to view its properties.</div>';
            return;
        }

        const fragment = document.createDocumentFragment();
        
        const createPropGroup = (label) => {
            const group = document.createElement('div'); group.className = 'prop-group';
            const labelEl = document.createElement('label'); labelEl.textContent = label;
            group.appendChild(labelEl); fragment.appendChild(group);
            return group;
        };
        const createVec3Inputs = (group, vec, step, callback) => {
            const container = document.createElement('div'); container.className = 'prop-input-group';
            ['x', 'y', 'z'].forEach(axis => {
                const input = document.createElement('input'); input.type = 'number';
                
                const currentStep = typeof step === 'object' ? (step[axis] || 0.1) : step;
                input.step = currentStep;
                
                const isInt = currentStep >= 1;
                input.value = isInt ? (vec[axis] || 0).toFixed(0) : (vec[axis] || 0).toFixed(3);

                input.onchange = () => callback(axis, parseFloat(input.value));
                container.appendChild(input);
            });
            group.appendChild(container);
        };
        
        const nameGroup = createPropGroup('Name');
        const nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.value = obj.name;
        nameInput.onchange = () => this.app.undoManager.execute(new StateChangeCommand(this.app, { entity: obj, beforeState: { name: obj.name }, afterState: { name: nameInput.value } }));
        nameGroup.appendChild(nameInput);
        
        fragment.appendChild(document.createElement('hr'));

        const posGroup = createPropGroup('Position');
        createVec3Inputs(posGroup, obj.position, 0.1, (axis, value) => {
            const before = { position: obj.position.clone() };
            const after = { position: obj.position.clone() }; after.position[axis] = value;
            this.app.undoManager.execute(new StateChangeCommand(this.app, { entity: obj, beforeState: before, afterState: after }));
        });

        const rotGroup = createPropGroup('Rotation (Deg)');
        const eulerDeg = new THREE.Euler().setFromQuaternion(obj.quaternion, 'YXZ');
        eulerDeg.x = THREE.MathUtils.radToDeg(eulerDeg.x); eulerDeg.y = THREE.MathUtils.radToDeg(eulerDeg.y); eulerDeg.z = THREE.MathUtils.radToDeg(eulerDeg.z);
        createVec3Inputs(rotGroup, eulerDeg, 5, (axis, value) => {
            const before = { quaternion: obj.quaternion.clone() };
            const newEuler = new THREE.Euler().setFromQuaternion(obj.quaternion, 'YXZ');
            newEuler[axis] = THREE.MathUtils.degToRad(value);
            const after = { quaternion: new THREE.Quaternion().setFromEuler(newEuler) };
            this.app.undoManager.execute(new StateChangeCommand(this.app, { entity: obj, beforeState: before, afterState: after }));
        });
        
        const sizeGroup = createPropGroup('Size');
        const displaySize = {};
        let steps = 0.1;
        const params = obj.geometry.parameters;
        
        switch (obj.geometry.type) {
            case 'BoxGeometry':
                displaySize.x = params.width;
                displaySize.y = params.height;
                displaySize.z = params.depth;
                break;
            case 'CylinderGeometry':
                displaySize.x = params.radiusTop;
                displaySize.y = params.height;
                displaySize.z = params.radiusBottom;
                break;
            case 'SphereGeometry':
                displaySize.x = params.radius;
                displaySize.y = params.widthSegments;
                displaySize.z = params.heightSegments;
                steps = { x: 0.1, y: 1, z: 1 };
                break;
            default:
                displaySize.x = 0; displaySize.y = 0; displaySize.z = 0;
                break;
        }

        createVec3Inputs(sizeGroup, displaySize, steps, (axis, value) => {
            const before = { geometry: { ...obj.geometry.parameters } };
            const after = { geometry: { ...obj.geometry.parameters } };
            const keyMap = { x: 'width', y: 'height', z: 'depth' };
            if(obj.geometry.type === 'CylinderGeometry') { Object.assign(keyMap, { x: 'radiusTop', y: 'height', z: 'radiusBottom'}); }
            if(obj.geometry.type === 'SphereGeometry') { Object.assign(keyMap, { x: 'radius', y: 'widthSegments', z: 'heightSegments'}); }

            const propName = keyMap[axis];
            if (propName) {
                if (obj.geometry.type === 'SphereGeometry' && (axis === 'y' || axis === 'z')) {
                    value = Math.max(3, Math.round(value));
                }
                after.geometry[propName] = value;
                this.app.undoManager.execute(new StateChangeCommand(this.app, { entity: obj, beforeState: before, afterState: after }));
            }
        });

        fragment.appendChild(document.createElement('hr'));

        const matGroup = createPropGroup('Material');
        const matContainer = document.createElement('div'); matContainer.className = 'prop-input-group';
        const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.value = '#' + obj.material.color.getHexString();
        colorInput.oninput = () => obj.material.color.set(colorInput.value);
        const beforeColor = obj.material.color.getHex();
        colorInput.onchange = () => this.app.undoManager.execute(new StateChangeCommand(this.app, { entity: obj, beforeState: { material: { color: beforeColor }}, afterState: { material: { color: obj.material.color.getHex() }}}));
        matContainer.appendChild(colorInput);
        matGroup.appendChild(matContainer);
        
        this.inspectorContent.appendChild(fragment);
    }
    
    updateTransformModeButtons(mode) {
        ['translate', 'rotate', 'scale'].forEach(m => document.getElementById(`tool-${m}`).classList.toggle('active', m === mode));
    }
    
    onTestAsset() {
        const placeholderAssetData = this.app.assetContext.serialize();
        try {
            localStorage.setItem('editorAssetData', JSON.stringify(placeholderAssetData));
            window.open('index.html?loadAssetForTest=true', '_blank');
        } catch (e) { console.error("Failed to save asset:", e); alert("Could not test asset."); }
    }
}