import * as THREE from 'three';

export class EditorUI {
    constructor(editor) {
        this.editor = editor;
        this.app = editor.app;
        this.init();
    }

    init() {
        // Toolbar
        document.getElementById('editor-load-btn').onclick = () => document.getElementById('editor-file-input').click();
        document.getElementById('editor-file-input').onchange = (e) => this.editor.actions.loadFile(e);
        document.getElementById('editor-save-btn').onclick = () => this.editor.actions.saveFile();
        document.getElementById('editor-info-btn').onclick = () => this.showInfoModal();
        document.getElementById('editor-back-to-menu').onclick = () => { window.location.href = 'index.html'; };
        document.getElementById('editor-mode-translate').onclick = () => this.editor.controls.setTransformMode('translate');
        document.getElementById('editor-mode-rotate').onclick = () => this.editor.controls.setTransformMode('rotate');
        document.getElementById('editor-mode-scale').onclick = () => this.editor.controls.setTransformMode('scale');

        // Scene Accordion
        document.getElementById('skybox-color-input').oninput = (e) => this.editor.actions.updateSkyboxColor(e.target.value);
        document.getElementById('ambient-color-input').oninput = (e) => this.editor.actions.updateAmbientLight('color', e.target.value);
        document.getElementById('ambient-intensity-input').oninput = (e) => this.editor.actions.updateAmbientLight('intensity', e.target.value);

        // Create Accordion
        document.getElementById('editor-add-box').onclick = () => this.editor.actions.addBox();
        document.getElementById('editor-add-enemy').onclick = () => this.editor.actions.addEnemy();
        document.getElementById('add-dirlight-btn').onclick = () => this.app.addDirectionalLight();
        document.getElementById('editor-add-msg-trigger').onclick = () => this.editor.actions.addMessageTrigger();
        document.getElementById('editor-add-death-trigger').onclick = () => this.editor.actions.addDeathTrigger();
        document.getElementById('editor-set-spawn').onclick = () => this.editor.actions.setSpawnPointToCamera();
        document.getElementById('editor-set-death-spawn').onclick = () => this.editor.actions.setDeathSpawnPointToCamera();

        // View Options Accordion
        document.getElementById('view-toggle-msg-triggers').onchange = (e) => this.setHelpersVisibility('msgTriggers', e.target.checked);
        document.getElementById('view-toggle-death-triggers').onchange = (e) => this.setHelpersVisibility('deathTriggers', e.target.checked);
        document.getElementById('view-toggle-light-helpers').onchange = (e) => this.setHelpersVisibility('lightHelpers', e.target.checked);
        document.getElementById('view-toggle-spawn-helpers').onchange = (e) => this.setHelpersVisibility('spawnHelpers', e.target.checked);

        // Outliner
        this.outlinerList = document.getElementById('outliner-list');
        this.outlinerList.onclick = (e) => {
            const item = e.target.closest('.outliner-item');
            if (item) this.editor.selectByUUID(item.dataset.uuid);
        };

        // Properties Panel
        this.propertiesAccordion = document.getElementById('properties-accordion');
        this.propertiesContent = document.getElementById('properties-content');
        document.getElementById('editor-delete-btn').onclick = () => this.editor.actions.deleteSelected();
        
        // Modal Events
        document.querySelector('#editor-info-modal .modal-close-btn').onclick = () => {
            document.getElementById('editor-info-modal').style.display = 'none';
        };
        document.getElementById('editor-info-modal').onclick = (e) => {
            if(e.target === e.currentTarget) e.currentTarget.style.display = 'none';
        };
    }

    showInfoModal() {
        // --- Player & Physics Parameters (from Player.js and Physics.js) ---
        const playerRadius = 0.8;
        const speed = 8;
        const jumpVy = 8;
        const dashMultiplier = 4;
        const dashDuration = 0.2;
        const gravity = 9.82; // Absolute value

        // --- Calculations ---
        const playerHeight = playerRadius * 2;
        const dashSpeed = speed * dashMultiplier;
        const groundDashDist = dashSpeed * dashDuration;

        // Single Jump
        const timeToPeak1 = jumpVy / gravity;
        const height1 = (jumpVy * jumpVy) / (2 * gravity);
        const airTime1 = 2 * timeToPeak1;
        const distance1 = speed * airTime1;

        // Double Jump (Max Height: jump at peak of first)
        const height2 = height1 + height1; // Second jump from peak (v=0) gains same height
        const timeToFallFromH2 = Math.sqrt((2 * height2) / gravity);
        const airTime2_height = timeToPeak1 + timeToFallFromH2;
        const distance2_height = speed * airTime2_height;
        
        // Jump + Dash (Max Distance: dash at peak)
        const horizontalDistToPeak = speed * timeToPeak1;
        const timeToFallFromH1 = timeToPeak1; // Symmetry
        const horizontalDistAfterDash = speed * timeToFallFromH1;
        const jumpDashDist = horizontalDistToPeak + groundDashDist + horizontalDistAfterDash;

        const infoText = `
[Base Parameters]
Player Collider Height: ${playerHeight.toFixed(2)}m
Ground Speed          : ${speed.toFixed(2)} m/s
Dash Speed            : ${dashSpeed.toFixed(2)} m/s
Gravity               : ${gravity.toFixed(2)} m/s²

[Ground Movement]
Dash Distance         : ${groundDashDist.toFixed(2)}m

[Single Jump]
Max Height            : ${height1.toFixed(2)}m (Gap clearance: ${(height1 + playerHeight).toFixed(2)}m)
Max Distance          : ${distance1.toFixed(2)}m
Air Time              : ${airTime1.toFixed(2)}s

[Double Jump (for max height)]
Max Height            : ${height2.toFixed(2)}m (Gap clearance: ${(height2 + playerHeight).toFixed(2)}m)
Horizontal Distance   : ${distance2_height.toFixed(2)}m
Air Time              : ${airTime2_height.toFixed(2)}s

[Jump + Dash (for max distance)]
Max Distance          : ${jumpDashDist.toFixed(2)}m

NOTE: Distances are ideal, assuming flat ground. "Gap clearance" is max height + player height.
        `.trim();

        document.getElementById('info-modal-text').textContent = infoText;
        document.getElementById('editor-info-modal').style.display = 'flex';
    }


    updateTransformModeButtons(mode) {
        ['translate', 'rotate', 'scale'].forEach(m => {
            document.getElementById(`editor-mode-${m}`).classList.toggle('active', m === mode);
        });
    }

    updateOutliner() {
        this.outlinerList.innerHTML = '';
        const createItem = (entity, name, uuid, prefix = '') => {
            const item = document.createElement('div');
            item.className = 'outliner-item';
            item.textContent = `${prefix} ${name}`;
            item.dataset.uuid = uuid;
            if (entity === this.editor.selectedObject) item.classList.add('selected');
            this.outlinerList.appendChild(item);
        };

        if (this.app.spawnPointHelper) createItem(this.app.spawnPointHelper, 'Initial Spawn', this.app.spawnPointHelper.uuid, '[P]');
        if (this.app.deathSpawnPointHelper) createItem(this.app.deathSpawnPointHelper, 'Death Spawn', this.app.deathSpawnPointHelper.uuid, '[P]');
        this.app.directionalLights.forEach((l, i) => createItem(l, `Directional Light ${i+1}`, l.picker.uuid, '[L]'));
        this.app.levelObjects.forEach(o => createItem(o, o.definition.name || 'Object', o.mesh.uuid, '[G]'));
        this.app.enemies.forEach(e => createItem(e, e.name || 'Enemy', e.mesh.uuid, '[E]'));
        this.app.triggers.forEach((t, i) => createItem(t, t.definition.name || `Trigger ${i+1}`, t.mesh.uuid, '[T]'));
        this.app.deathTriggers.forEach((t, i) => createItem(t, t.definition.name || `Death Zone ${i+1}`, t.mesh.uuid, '[D]'));
    }

    updatePropertiesPanel() {
        if (!this.editor.selectedObject) {
            this.propertiesAccordion.style.display = 'none';
            return;
        }
        this.propertiesContent.innerHTML = '';
        const entity = this.editor.selectedObject;
        const entityType = entity.userData?.gameEntity?.type;
        
        if (!entityType) return;
        
        this.propertiesAccordion.style.display = 'block';
        this.propertiesAccordion.open = true;
        const fragment = document.createDocumentFragment();

        const handleEnterKey = (e, updateFn) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                updateFn(e.target.value);
                e.target.blur();
            }
        };

        const createVec3Inputs = (label, vector, callback) => {
            fragment.appendChild(document.createElement('label')).textContent = label;
            const group = fragment.appendChild(document.createElement('div'));
            group.className = 'prop-group';
            ['x', 'y', 'z'].forEach(axis => {
                const input = document.createElement('input');
                input.type = 'number';
                input.step = label.toLowerCase().includes('rot') ? 1 : 0.1;
                input.value = vector[axis].toFixed(2);
                const updateValue = (val) => callback(axis, parseFloat(val));
                input.onchange = (e) => updateValue(e.target.value);
                input.onkeydown = (e) => handleEnterKey(e, updateValue);
                group.appendChild(input);
            });
        };
        
        const createSizeInputs = (label, sizeArr, callback) => {
             fragment.appendChild(document.createElement('label')).textContent = label;
             const group = fragment.appendChild(document.createElement('div'));
             group.className = 'prop-group';
             sizeArr.forEach((val, index) => {
                 const input = document.createElement('input');
                 input.type = 'number';
                 input.step = 0.1;
                 input.value = val.toFixed(2);
                 const updateValue = (val) => callback(index, parseFloat(val));
                 input.onchange = (e) => updateValue(e.target.value);
                 input.onkeydown = (e) => handleEnterKey(e, updateValue);
                 group.appendChild(input);
             });
        };
        
        const createColorInput = (label, color, callback) => {
            fragment.appendChild(document.createElement('label')).textContent = label;
            const input = fragment.appendChild(document.createElement('input'));
            input.type = 'color';
            input.value = '#' + color.getHexString();
            input.oninput = (e) => callback(e.target.value);
        };
        
        const createTextInput = (label, value, callback) => {
            fragment.appendChild(document.createElement('label')).textContent = label;
            const input = fragment.appendChild(document.createElement('input'));
            input.type = 'text';
            input.value = value;
            const updateValue = (val) => callback(val);
            input.onchange = (e) => updateValue(e.target.value);
            input.onkeydown = (e) => handleEnterKey(e, updateValue);
        };
        
        const createNumberInput = (label, value, min, max, step, callback) => {
            fragment.appendChild(document.createElement('label')).textContent = label;
            const input = fragment.appendChild(document.createElement('input'));
            input.type = 'number';
            if (min !== undefined) input.min = min;
            if (max !== undefined) input.max = max;
            input.step = step || 1;
            input.value = value;
            const updateValue = (val) => callback(parseFloat(val));
            input.onchange = (e) => updateValue(e.target.value);
            input.onkeydown = (e) => handleEnterKey(e, updateValue);
        };
        
        if (entityType === 'Trigger' || entityType === 'DeathTrigger') {
            const def = entity.definition;
            const mesh = entity.mesh;

            createTextInput('Name', def.name || '', val => this.editor.updateSelectedProp('name', null, val));
            createVec3Inputs('Position', mesh.position, (axis, val) => this.editor.updateSelectedProp('position', axis, val));
            createSizeInputs('Size', def.size, (index, val) => this.editor.updateSelectedProp('size', index, val));
            
            if (entityType === 'Trigger') {
                fragment.appendChild(document.createElement('hr'));
                createTextInput('Message', def.message || '', val => this.editor.updateSelectedProp('message', null, val));
                createNumberInput('Duration (s)', def.duration || 5, 0.1, 100, 0.1, val => this.editor.updateSelectedProp('duration', null, val));
                const initialColor = def.color ? parseInt(def.color, 16) : 0x00ff00;
                createColorInput('Helper Color', new THREE.Color(initialColor), val => this.editor.updateSelectedProp('color', null, val));
            }
        } else if (entityType === 'SpawnPoint' || entityType === 'DeathSpawnPoint') {
             createVec3Inputs('Position', entity.position, (axis, val) => {
                entity.position[axis] = val;
                this.editor.syncObjectTransforms();
             });
        } else if (entityType === 'DirectionalLight') {
             createColorInput('Color', entity.light.color, val => this.editor.updateSelectedProp('color', null, val));
             createNumberInput('Intensity', entity.light.intensity, 0, 20, 0.1, val => this.editor.updateSelectedProp('intensity', null, val));
             createVec3Inputs('Position', entity.light.position, (axis, val) => {
                 entity.picker.position[axis] = val; // Move the picker
                 this.editor.syncObjectTransforms(); // Sync picker to light
                 this.updatePropertiesPanel(); // Redraw panel with new values
             });
             // NEW: Inputs for Target Position
             createVec3Inputs('Target Position', entity.light.target.position, (axis, val) => {
                 this.editor.updateSelectedProp('targetPosition', axis, val);
             });
        } else { // Generic Object or Enemy
            const def = entity.definition;
            const mesh = entity.mesh;
            fragment.appendChild(document.createElement('label')).textContent = `Name: ${def.name || def.type}`;
            createVec3Inputs('Position', mesh.position, (axis, val) => this.editor.updateSelectedProp('position', axis, val));
            if (entity.isDead === undefined && def.type !== 'Plane') {
                 const eulerRot = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'YXZ');
                 const degRot = { x: THREE.MathUtils.radToDeg(eulerRot.x), y: THREE.MathUtils.radToDeg(eulerRot.y), z: THREE.MathUtils.radToDeg(eulerRot.z) };
                 createVec3Inputs('Rotation', degRot, (axis, val) => this.editor.updateSelectedProp('rotation', axis, val));
            }
            if (def.size) createSizeInputs('Size', def.size, (index, val) => this.editor.updateSelectedProp('size', index, val));

            if (def.material) {
                fragment.appendChild(document.createElement('hr'));
                const initialColor = def.material.color ? parseInt(def.material.color, 16) : 0xcccccc;
                createColorInput('Material Color', new THREE.Color(initialColor), val => {
                    this.editor.updateSelectedProp('material.color', null, val);
                });
            }
        }
        this.propertiesContent.appendChild(fragment);
    }
    
    setInitialSceneSettings(settings) {
        if (!settings) return;
        document.getElementById('skybox-color-input').value = '#' + new THREE.Color(parseInt(settings.backgroundColor || "0x000000", 16)).getHexString();
        document.getElementById('ambient-color-input').value = '#' + new THREE.Color(parseInt(settings.ambientLight.color, 16)).getHexString();
        document.getElementById('ambient-intensity-input').value = settings.ambientLight.intensity;
    }

    setHelpersVisibility(type, isVisible) {
        this.editor.helperVisibility[type] = isVisible;
        switch (type) {
            case 'msgTriggers':   this.app.triggers.forEach(t => t.mesh.visible = isVisible); break;
            case 'deathTriggers': this.app.deathTriggers.forEach(t => t.mesh.visible = isVisible); break;
            case 'lightHelpers':  this.app.directionalLights.forEach(l => l.helper.visible = isVisible); break;
            case 'spawnHelpers':
                if (this.app.spawnPointHelper) this.app.spawnPointHelper.visible = isVisible;
                if (this.app.deathSpawnPointHelper) this.app.deathSpawnPointHelper.visible = isVisible;
                break;
        }
    }
}