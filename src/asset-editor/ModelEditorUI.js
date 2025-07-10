import * as THREE from 'three';
import { StateChangeCommand } from './UndoManager.js';

export class ModelEditorUI {
    constructor(app) {
        this.app = app;
        this.outlinerContent = document.getElementById('outliner-content');
        this.inspectorContent = document.getElementById('inspector-content');
        this.timelineTrackArea = document.getElementById('editor-timeline').querySelector('.timeline-track-area');
        
        this.elements = {
            fileInput: document.getElementById('asset-file-input'),
        };

        // Timeline elements
        this.animationClipSelect = document.getElementById('animation-clip-select');
        this.animPlayBtn = document.getElementById('anim-play-btn');
        this.animStopBtn = document.getElementById('anim-stop-btn');
        this.animTimeDisplay = document.getElementById('anim-time-display');

        this.draggedElement = null;
        this.selectedKeyframeInfo = null;
        this.init();
    }

    init() {
        // --- Menu ---
        document.getElementById('menu-file-new-weapon').onclick = () => this.app.actions._loadDataWithUndo(null);
        document.getElementById('menu-file-open').onclick = () => this.openAsset();
        document.getElementById('menu-file-save').onclick = () => this.saveAsset();
        document.getElementById('menu-file-exit').onclick = () => { window.location.href = 'index.html'; };
        document.getElementById('menu-file-load-example-pistol').onclick = () => this.app.actions.loadExamplePistol();
        document.getElementById('menu-file-load-example-dagger').onclick = () => this.app.actions.loadExampleDagger();
        document.getElementById('menu-file-test-viewmodel').onclick = () => this.app.enterViewModelTest();
        document.getElementById('menu-edit-delete').onclick = () => {
            if (this.selectedKeyframeInfo) this.app.actions.deleteSelectedKeyframe();
            else this.app.actions.deleteSelected();
        };
        document.getElementById('menu-edit-undo').onclick = () => this.app.undoManager.undo();
        document.getElementById('menu-edit-redo').onclick = () => this.app.undoManager.redo();
        document.getElementById('menu-help-guide').onclick = () => this.showHelpModal(true);

        // --- File Input ---
        this.elements.fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    this.app.actions.loadFile(data);
                } catch (error) {
                    console.error("Failed to load or parse asset file:", error);
                    alert("Error: Invalid or corrupt asset file.");
                } finally {
                    e.target.value = null; // Reset input so the same file can be opened again
                }
            };
            reader.readAsText(file);
        };

        // --- View Menu ---
        document.getElementById('view-toggle-grid').onchange = (e) => { if(this.app.gridHelper) this.app.gridHelper.visible = e.target.checked; };
        document.getElementById('view-toggle-viewmodel-guide').onchange = (e) => { if(this.app.viewModelGuide) this.app.viewModelGuide.setVisible(e.target.checked); };

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

        // --- Timeline ---
        this.animationClipSelect.onchange = () => this.updateTimelineView();
        this.timelineTrackArea.addEventListener('click', (e) => this.handleTimelineClick(e));

        // --- Viewmodel Test ---
        document.getElementById('exit-test-mode-btn').onclick = () => this.app.exitViewModelTest();

        // --- Help Modal ---
        const helpModal = document.getElementById('help-modal');
        helpModal.querySelector('.modal-close-btn').onclick = () => this.showHelpModal(false);
        helpModal.onclick = (e) => { if (e.target === e.currentTarget) this.showHelpModal(false); };

        // --- Top Menu Hover Logic to close other menus ---
        const menuDropdowns = document.querySelectorAll('#editor-menu-bar .menu-dropdown');
        menuDropdowns.forEach(dropdown => {
            dropdown.addEventListener('pointerenter', () => {
                const openDropdown = document.querySelector('#editor-menu-bar .menu-dropdown[open]');
                if (openDropdown && openDropdown !== dropdown) {
                    openDropdown.open = false;
                }
                dropdown.open = true;
            });

            dropdown.addEventListener('mouseleave', () => {
                dropdown.open = false;
            });
        });
    }

    openAsset() {
        this.elements.fileInput.click();
    }

    saveAsset() {
        const assetData = this.app.assetContext.serialize();
        const assetName = assetData.assetName || 'custom-asset';
        const filename = `${assetName.toLowerCase().replace(/\s+/g, '-')}.json`;
        const blob = new Blob([JSON.stringify(assetData, null, 2)], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    handleTimelineClick(e) {
        if(e.target.classList.contains('timeline-keyframe')) {
            this.selectKeyframe(
                e.target.dataset.clipName,
                parseInt(e.target.dataset.trackIndex),
                parseInt(e.target.dataset.keyIndex)
            );
        } else {
            this.deselectKeyframe();
        }
    }
    
    selectKeyframe(clipName, trackIndex, keyIndex) {
        this.app.deselect(); // Deselect any 3D objects
        this.selectedKeyframeInfo = { clipName, trackIndex, keyIndex };
        const keyframe = this.app.assetContext.animations[clipName].tracks[trackIndex].keyframes[keyIndex];
        this.app.animationManager.seek(keyframe.time);
        this.updateOnSelectionChange();
    }
    
    deselectKeyframe() {
        if (!this.selectedKeyframeInfo) return;
        this.selectedKeyframeInfo = null;
        this.updateOnSelectionChange();
    }

    updateAnimationClips() {
        this.animationClipSelect.innerHTML = '';
        const clips = this.app.assetContext.animations;
        const clipNames = Object.keys(clips);
        if (clipNames.length === 0) {
            this.animationClipSelect.disabled = true;
            const defaultOption = document.createElement('option');
            defaultOption.textContent = "No Clips";
            this.animationClipSelect.appendChild(defaultOption);
        } else {
            this.animationClipSelect.disabled = false;
            clipNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                this.animationClipSelect.appendChild(option);
            });
        }
        this.updateTimelineView();
    }
    
    updateTimelineView() {
        this.timelineTrackArea.innerHTML = '<div class="timeline-scrubber"></div>';

        const clipName = this.animationClipSelect.value;
        const clip = this.app.assetContext.animations[clipName];

        if (!clip) return;

        clip.tracks.forEach((track, trackIndex) => {
            const trackDiv = document.createElement('div');
            trackDiv.className = 'timeline-track';

            const target = track.targetUUID === 'AssetRoot'
                ? this.app.assetContext.assetRoot
                : this.app.assetContext.parts.get(track.targetUUID);

            const label = document.createElement('div');
            label.className = 'track-label';
            label.textContent = `${target?.name || 'Unknown'}.${track.property}`;
            trackDiv.appendChild(label);

            const keyframeContainer = document.createElement('div');
            keyframeContainer.className = 'track-keyframes';

            track.keyframes.forEach((keyframe, keyIndex) => {
                const keyframeDiv = document.createElement('div');
                keyframeDiv.className = 'timeline-keyframe';
                keyframeDiv.style.left = `${(keyframe.time / clip.duration) * 100}%`;
                keyframeDiv.title = `Time: ${keyframe.time.toFixed(2)}s`;
                keyframeDiv.dataset.clipName = clipName;
                keyframeDiv.dataset.trackIndex = trackIndex;
                keyframeDiv.dataset.keyIndex = keyIndex;
                if(this.selectedKeyframeInfo?.clipName === clipName && this.selectedKeyframeInfo?.trackIndex === trackIndex && this.selectedKeyframeInfo?.keyIndex === keyIndex) {
                    keyframeDiv.classList.add('selected');
                }
                keyframeContainer.appendChild(keyframeDiv);
            });

            trackDiv.appendChild(keyframeContainer);
            this.timelineTrackArea.appendChild(trackDiv);
        });
    }
    
    showHelpModal(show) {
        document.getElementById('help-modal').style.display = show ? 'flex' : 'none';
    }

    updateOnSelectionChange() {
        const isObjectSelected = this.app.selectedObjects.size > 0;
        const isKeyframeSelected = !!this.selectedKeyframeInfo;
        document.getElementById('menu-edit-delete').disabled = !isObjectSelected && !isKeyframeSelected;

        this.updateOutliner();
        this.updateInspector();
        this.updateTimelineView();
    }

    handleOutlinerClick(event) {
        this.deselectKeyframe();
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
        if(this.selectedKeyframeInfo) {
            this.renderKeyframeInspector();
        } else if (this.app.selectedObjects.size > 0) {
            this.renderObjectInspector();
        } else {
            this.inspectorContent.innerHTML = '<div class="placeholder-text">Select a part or keyframe to view its properties.</div>';
        }
    }

    renderKeyframeInspector() {
        const { clipName, trackIndex, keyIndex } = this.selectedKeyframeInfo;
        const track = this.app.assetContext.animations[clipName].tracks[trackIndex];
        const keyframe = track.keyframes[keyIndex];
        const target = track.targetUUID === 'AssetRoot' ? this.app.assetContext.assetRoot : this.app.assetContext.parts.get(track.targetUUID);

        const fragment = document.createDocumentFragment();

        const infoBox = document.createElement('div');
        infoBox.className = 'keyframe-info-box';
        infoBox.innerHTML = `<b>${target?.name || 'Unknown'}</b><br>${track.property}`;
        fragment.appendChild(infoBox);
        fragment.appendChild(document.createElement('hr'));
        
        const createPropGroup = (label) => {
            const group = document.createElement('div'); group.className = 'prop-group';
            const labelEl = document.createElement('label'); labelEl.textContent = label;
            group.appendChild(labelEl); fragment.appendChild(group);
            return group;
        };

        const timeGroup = createPropGroup('Time (s)');
        const timeInput = document.createElement('input');
        timeInput.type = 'number'; timeInput.step = 0.01; timeInput.value = keyframe.time.toFixed(2);
        timeInput.onchange = () => this.app.actions.updateKeyframeProperty(this.selectedKeyframeInfo, 'time', parseFloat(timeInput.value));
        timeGroup.appendChild(timeInput);

        const valueGroup = createPropGroup('Value');
        if(Array.isArray(keyframe.value)) {
            const container = document.createElement('div'); container.className = 'prop-input-group';
            ['x', 'y', 'z'].forEach((axis, i) => {
                if (keyframe.value[i] === undefined) return;
                const input = document.createElement('input'); input.type = 'number'; input.step = 0.01; input.value = keyframe.value[i].toFixed(2);
                input.onchange = () => this.app.actions.updateKeyframeProperty(this.selectedKeyframeInfo, axis, parseFloat(input.value));
                container.appendChild(input);
            });
            valueGroup.appendChild(container);
        }

        fragment.appendChild(document.createElement('hr'));
        const deleteButton = document.createElement('button');
        deleteButton.textContent = "Delete Keyframe";
        deleteButton.className = "delete-button";
        deleteButton.onclick = () => this.app.actions.deleteSelectedKeyframe();
        fragment.appendChild(deleteButton);

        this.inspectorContent.appendChild(fragment);
    }

    renderObjectInspector() {
        const obj = this.app.primarySelectedObject;
        if (!obj) return;

        const fragment = document.createDocumentFragment();
        
        if (this.app.selectedObjects.size > 1) {
             const multiSelectInfo = document.createElement('div');
            multiSelectInfo.className = 'placeholder-text';
            multiSelectInfo.innerHTML = `<b>${this.app.selectedObjects.size} objects selected.</b><br>Properties shown for primary selection.`;
            fragment.appendChild(multiSelectInfo);
        }
        
        const createPropGroup = (label) => {
            const group = document.createElement('div');
            group.className = 'prop-group';
            const labelEl = document.createElement('label');
            labelEl.textContent = label;
            group.appendChild(labelEl);
            fragment.appendChild(group);
            return group;
        };
        
        const createVec3Inputs = (group, vec, step, callback) => {
            const container = document.createElement('div');
            container.className = 'prop-input-group';
            ['x', 'y', 'z'].forEach(axis => {
                const input = document.createElement('input');
                input.type = 'number';
                
                const currentStep = typeof step === 'object' ? (step[axis] || 0.1) : step;
                input.step = currentStep;
                
                const isInt = currentStep >= 1;
                input.value = isInt ? (vec[axis] || 0).toFixed(0) : (vec[axis] || 0).toFixed(3);

                input.onchange = () => callback(axis, parseFloat(input.value));
                container.appendChild(input);
            });
            group.appendChild(container);
        };
        
        const createSingleNumberInput = (parent, value, { min, max, step = 0.1 }, callback) => {
            const input = document.createElement('input');
            input.type = 'number';
            if (min !== undefined) input.min = min;
            if (max !== undefined) input.max = max;
            input.step = step;
            input.value = value.toFixed(2);
            input.onchange = (e) => callback(parseFloat(e.target.value));
            parent.appendChild(input);
            return input;
        };
        
        const nameGroup = createPropGroup('Name');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = obj.name;
        nameInput.onchange = () => this.app.undoManager.execute(new StateChangeCommand(this.app, { entity: obj, beforeState: { name: obj.name }, afterState: { name: nameInput.value } }));
        nameGroup.appendChild(nameInput);
        
        fragment.appendChild(document.createElement('hr'));

        const posGroup = createPropGroup('Position');
        createVec3Inputs(posGroup, obj.position, 0.1, (axis, value) => {
            const before = { position: obj.position.clone() };
            const after = { position: obj.position.clone() };
            after.position[axis] = value;
            this.app.undoManager.execute(new StateChangeCommand(this.app, { entity: obj, beforeState: before, afterState: after }));
        });

        const rotGroup = createPropGroup('Rotation (Deg)');
        const eulerDeg = new THREE.Euler().setFromQuaternion(obj.quaternion, 'YXZ');
        eulerDeg.x = THREE.MathUtils.radToDeg(eulerDeg.x);
        eulerDeg.y = THREE.MathUtils.radToDeg(eulerDeg.y);
        eulerDeg.z = THREE.MathUtils.radToDeg(eulerDeg.z);
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
            if (obj.geometry.type === 'CylinderGeometry') { Object.assign(keyMap, { x: 'radiusTop', y: 'height', z: 'radiusBottom'}); }
            if (obj.geometry.type === 'SphereGeometry') { Object.assign(keyMap, { x: 'radius', y: 'widthSegments', z: 'heightSegments'}); }

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
        const matContainer = document.createElement('div');
        matContainer.className = 'prop-input-group';
        
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = '#' + obj.material.color.getHexString();
        colorInput.oninput = () => obj.material.color.set(colorInput.value);
        colorInput.onchange = () => {
            const command = new StateChangeCommand(this.app, {
                entity: obj,
                beforeState: { material: { color: parseInt(colorInput.value.replace('#', ''), 16) } }, // This might not capture the true before state if changed via oninput
                afterState: { material: { color: obj.material.color.getHex() } }
            });
            // This undo logic for color is simplified and might not be perfect with oninput.
            // A more robust solution would store the color state on focus/mousedown.
        };
        matContainer.appendChild(colorInput);
        matGroup.appendChild(matContainer);
        
        const metalnessGroup = createPropGroup('Metalness');
        createSingleNumberInput(metalnessGroup, obj.material.metalness, { min: 0, max: 1, step: 0.05 }, (val) => {
            const command = new StateChangeCommand(this.app, {
                entity: obj,
                beforeState: { material: { metalness: obj.material.metalness } },
                afterState: { material: { metalness: val } }
            });
            this.app.undoManager.execute(command);
        });

        const roughnessGroup = createPropGroup('Roughness');
        createSingleNumberInput(roughnessGroup, obj.material.roughness, { min: 0, max: 1, step: 0.05 }, (val) => {
            const command = new StateChangeCommand(this.app, {
                entity: obj,
                beforeState: { material: { roughness: obj.material.roughness } },
                afterState: { material: { roughness: val } }
            });
            this.app.undoManager.execute(command);
        });

        this.inspectorContent.appendChild(fragment);
    }
    
    updateTransformModeButtons(mode) {
        ['translate', 'rotate', 'scale'].forEach(m => document.getElementById(`tool-${m}`).classList.toggle('active', m === mode));
    }
}