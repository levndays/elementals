 import * as THREE from 'three';
    import { StateChangeCommand } from './UndoManager.js';
    
    export class EditorUI {
        constructor(editor) {
            this.editor = editor;
            this.app = editor.app;
            this.skyboxOptions = [];
            this.init();
        }
    
        init() {
            // Fetch skybox manifest
            fetch('./assets/skyboxes/manifest.json')
                .then(res => res.ok ? res.json() : Promise.resolve([]))
                .then(data => { this.skyboxOptions = data; })
                .catch(err => console.error("Could not load skybox manifest.", err));
                
            // --- File Menu ---
            document.getElementById('menu-file-new').onclick = async () => await this.editor.actions.newLevel();
            document.getElementById('menu-file-open').onclick = () => document.getElementById('editor-file-input').click();
            document.getElementById('editor-file-input').onchange = async (e) => await this.editor.actions.loadFile(e);
            document.getElementById('menu-file-save').onclick = () => this.editor.actions.saveFile();
            document.getElementById('menu-file-play').onclick = () => this.editor.actions.playInDebugMode();
            document.getElementById('menu-file-exit').onclick = () => { window.location.href = 'index.html'; };
    
            // --- Edit Menu ---
            document.getElementById('menu-edit-undo').onclick = () => this.editor.undoManager.undo();
            document.getElementById('menu-edit-redo').onclick = () => this.editor.undoManager.redo();
            document.getElementById('menu-edit-copy').onclick = () => this.editor.actions.copySelected();
            document.getElementById('menu-edit-paste').onclick = () => this.editor.actions.pasteFromClipboard();
            document.getElementById('menu-edit-delete').onclick = () => this.editor.actions.deleteSelected();
            
            // --- View Menu ---
            document.getElementById('view-toggle-grid').onchange = (e) => { if(this.app.gridHelper) this.app.gridHelper.visible = e.target.checked; };
            document.getElementById('view-toggle-light-helpers').onchange = (e) => this.setHelpersVisibility('DirectionalLight', e.target.checked);
            document.getElementById('view-toggle-spawn-helpers').onchange = (e) => this.setHelpersVisibility('SpawnAndDeath', e.target.checked);
            document.getElementById('view-toggle-msg-triggers').onchange = (e) => this.setHelpersVisibility('Trigger', e.target.checked);
            document.getElementById('view-toggle-death-triggers').onchange = (e) => this.setHelpersVisibility('DeathTrigger', e.target.checked);
            document.getElementById('view-toggle-water-volumes').onchange = (e) => this.setHelpersVisibility('Water', e.target.checked);
            
            // --- Help Menu ---
            document.getElementById('menu-help-metrics').onclick = (event) => {
                event.preventDefault(); // Prevents the <details> menu from closing
                this.showInfoModal();
            };
    
            // --- Toolbar ---
            document.getElementById('tool-translate').onclick = () => this.editor.controls.setTransformMode('translate');
            document.getElementById('tool-rotate').onclick = () => this.editor.controls.setTransformMode('rotate');
            document.getElementById('tool-scale').onclick = () => this.editor.controls.setTransformMode('scale');
            document.getElementById('tool-space').onclick = () => this.editor.controls.toggleTransformSpace();
            
            // --- Snapping Controls ---
            const snapToggle = document.getElementById('snap-toggle');
            const transSnapInput = document.getElementById('snap-translation-input');
            const rotSnapInput = document.getElementById('snap-rotation-input');
            const snapLabel = document.querySelector('label[for="snap-toggle"]');
    
            snapToggle.onchange = (e) => this.editor.setSnapEnabled(e.target.checked);
            transSnapInput.onchange = (e) => this.editor.setTranslationSnap(parseFloat(e.target.value));
            rotSnapInput.onchange = (e) => this.editor.setRotationSnap(parseFloat(e.target.value));
            if (snapLabel) snapLabel.onclick = () => snapToggle.click();
    
            // Set initial UI values from editor state
            snapToggle.checked = this.editor.isSnapEnabled;
            transSnapInput.value = this.editor.translationSnapValue;
            rotSnapInput.value = this.editor.rotationSnapValue;
            
            // --- Create Button & Context Menu ---
            const createButton = document.getElementById('create-button');
            const createMenu = document.getElementById('create-context-menu');
            createButton.onclick = (e) => {
                e.stopPropagation(); // Prevent document click listener from firing immediately
                createMenu.style.display = createMenu.style.display === 'none' ? 'flex' : 'none';
            };
            createMenu.onclick = (e) => {
                const action = e.target.dataset.action;
                if (action && typeof this.editor.actions[action] === 'function') {
                    this.editor.actions[action]();
                }
                createMenu.style.display = 'none'; // Hide menu after action
            };
            // Hide menu if clicking anywhere else
            document.addEventListener('click', () => { createMenu.style.display = 'none'; });
    
            // --- Outliner ---
            this.outlinerContent = document.getElementById('outliner-content');
            this.outlinerContent.onclick = (e) => {
                const item = e.target.closest('.outliner-item');
                if (item) {
                    if (e.shiftKey) {
                        const entity = this.findEntityByUUID(item.dataset.uuid);
                        if (entity) {
                            if (this.editor.selectedObjects.has(entity)) {
                                this.editor.removeFromSelection(entity);
                            } else {
                                this.editor.addToSelection(entity);
                            }
                        }
                    } else {
                        this.editor.selectByUUID(item.dataset.uuid);
                    }
                }
            };
            
            // --- Inspector ---
            this.inspectorContent = document.getElementById('inspector-content');
            this.inspectorPlaceholder = this.inspectorContent.querySelector('.placeholder-text');
    
            // --- Modal Events ---
            document.querySelector('#editor-info-modal .modal-close-btn').onclick = () => { document.getElementById('editor-info-modal').style.display = 'none'; };
            document.getElementById('editor-info-modal').onclick = (e) => { if(e.target === e.currentTarget) e.currentTarget.style.display = 'none'; };
    
            // Top Menu Hover Logic to close other menus
            const menuDropdowns = document.querySelectorAll('.menu-dropdown');
            menuDropdowns.forEach(dropdown => {
                dropdown.addEventListener('mouseenter', () => dropdown.open = true);
                dropdown.addEventListener('mouseleave', () => dropdown.open = false);
                dropdown.addEventListener('pointerenter', () => {
                     if (document.querySelector('.menu-dropdown[open]') && document.querySelector('.menu-dropdown[open]') !== dropdown) {
                        document.querySelector('.menu-dropdown[open]').open = false;
                     }
                });
            });
        }
    
        findEntityByUUID(uuid) {
            return [...this.app.entities].find(e => {
                const mesh = e.mesh || e.picker || e.targetHelper || e;
                return mesh?.uuid === uuid;
            });
        }
    
        /**
         * REWORKED: Robustly checks if coordinates are over any UI panel.
         * This now uses elementFromPoint to correctly handle any element,
         * including inputs and their pop-ups (like the color picker).
         * @param {number} x - The screen X coordinate.
         * @param {number} y - The screen Y coordinate.
         * @returns {boolean}
         */
        isClickOnUI(x, y) {
            const el = document.elementFromPoint(x, y);
            if (!el) return false;
    
            const uiAreas = [
                document.getElementById('editor-menu-bar'),
                document.getElementById('editor-toolbar'),
                document.getElementById('editor-outliner'),
                document.getElementById('editor-inspector'),
                document.getElementById('create-button-container'),
            ];
        
            return uiAreas.some(area => area && area.contains(el));
        }
    
        showInfoModal() {
            const playerRadius = 0.8;
            const speed = 8;
            const jumpVy = 8;
            const dashMultiplier = 4;
            const dashDuration = 0.2;
            const gravity = 9.82; 
    
            const playerHeight = playerRadius * 2;
            const dashSpeed = speed * dashMultiplier;
            const groundDashDist = dashSpeed * dashDuration;
            const timeToPeak1 = jumpVy / gravity;
            const height1 = (jumpVy * jumpVy) / (2 * gravity);
            const airTime1 = 2 * timeToPeak1;
            const distance1 = speed * airTime1;
            const height2 = height1 + height1;
            const timeToFallFromH2 = Math.sqrt((2 * height2) / gravity);
            const airTime2_height = timeToPeak1 + timeToFallFromH2;
            const distance2_height = speed * airTime2_height;
            const horizontalDistToPeak = speed * timeToPeak1;
            const jumpDashDist = horizontalDistToPeak + groundDashDist + (speed * timeToPeak1);
    
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
                document.getElementById(`tool-${m}`).classList.toggle('active', m === mode);
            });
        }
    
        updateSpaceToggle(space) {
            document.getElementById('tool-space').textContent = space === 'world' ? 'World' : 'Local';
        }
    
        updateOutliner() {
            this.outlinerContent.innerHTML = '';
            const createItem = (parent, entity, name, uuid, prefix = '') => {
                const item = document.createElement('div');
                item.className = 'outliner-item';
                item.textContent = `${prefix} ${name}`;
                item.dataset.uuid = uuid;
                if (this.editor.selectedObjects.has(entity)) {
                    item.classList.add('selected');
                }
                parent.appendChild(item);
            };
        
            const createCategory = (title, entities, prefix, nameField = 'name') => {
                if (!entities || entities.length === 0) return;
                const details = document.createElement('details');
                details.open = true;
                const summary = document.createElement('summary');
                summary.textContent = `${title} (${entities.length})`;
                details.appendChild(summary);
                entities.forEach(e => {
                     const name = e.definition?.[nameField] || e.name || (e.userData?.gameEntity?.type) || 'Unnamed';
                     const uuidProvider = e.mesh || e.picker || e.helperMesh || e.targetHelper || e;
                     if(uuidProvider) {
                        createItem(details, e, name, uuidProvider.uuid, prefix);
                     }
                });
                this.outlinerContent.appendChild(details);
            };
        
            const spawnPoints = [this.app.spawnPointHelper, this.app.deathSpawnPointHelper].filter(Boolean);
            spawnPoints.forEach(sp => {
                sp.name = sp.userData.gameEntity.type === 'SpawnPoint' ? 'Initial Spawn' : 'Death Respawn';
            });
        
            createCategory('Scene Points', spawnPoints, '[P]', 'name');
            createCategory('Lights', this.app.getDirectionalLights(), '[L]');
            createCategory('Geometry', this.app.getLevelObjects(), '[G]');
            createCategory('Enemies', this.app.getEnemies(), '[E]');
            createCategory('Message Triggers', this.app.getTriggers(), '[T]');
            createCategory('Death Zones', this.app.getDeathTriggers(), '[D]');
            createCategory('Water Volumes', this.app.getWaterVolumes(), '[W]');
        }
    
        updatePropertiesPanel() {
            if (this.inspectorContent.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') {
                return;
            }
    
            this.inspectorContent.innerHTML = '';
            const fragment = document.createDocumentFragment();
            
            const handleEnterKey = (e, updateFn) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    updateFn(e.target.value);
                    e.target.blur();
                }
            };
        
            const createPropGroup = (label) => {
                const group = document.createElement('div');
                group.className = 'prop-group';
                const labelEl = document.createElement('label');
                labelEl.textContent = label;
                group.appendChild(labelEl);
                fragment.appendChild(group);
                return group;
            };
    
            const createTextInput = (parent, value, callback) => {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = value;
                const updateValue = (val) => callback(val);
                input.onchange = (e) => updateValue(e.target.value);
                input.onkeydown = (e) => handleEnterKey(e, updateValue);
                parent.appendChild(input);
                return input;
            };
        
            const createNumberInput = (parent, value, { min, max, step = 0.1 }, callback) => {
                const input = document.createElement('input');
                input.type = 'number';
                if (min !== undefined) input.min = min;
                if (max !== undefined) input.max = max;
                input.step = step;
                input.value = value;
                const updateValue = (val) => callback(parseFloat(val) || 0);
                input.onchange = (e) => updateValue(e.target.value);
                input.onkeydown = (e) => handleEnterKey(e, updateValue);
                parent.appendChild(input);
                return input;
            };
        
            const createColorInput = (parent, colorHex, callback) => {
                const input = document.createElement('input');
                input.type = 'color';
                input.value = colorHex;
                input.oninput = (e) => callback(e.target.value);
                parent.appendChild(input);
                return input;
            };
        
            const createVec3Inputs = (parent, vector, step, callback) => {
                const inputGroup = document.createElement('div');
                inputGroup.className = 'prop-input-group';
                ['x', 'y', 'z'].forEach(axis => {
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.step = step;
                    input.value = vector[axis].toFixed(3);
                    const updateValue = (val) => callback(axis, parseFloat(val) || 0);
                    input.onchange = (e) => updateValue(e.target.value);
                    input.onkeydown = (e) => handleEnterKey(e, updateValue);
                    inputGroup.appendChild(input);
                });
                parent.appendChild(inputGroup);
                return inputGroup;
            };
    
            if (this.editor.selectedObjects.size === 0) {
                this.renderSceneSettings(fragment, createPropGroup, createColorInput, createNumberInput);
            } else {
                if (this.editor.selectedObjects.size > 1) {
                    const multiSelectInfo = document.createElement('div');
                    multiSelectInfo.className = 'placeholder-text';
                    multiSelectInfo.innerHTML = `<b>${this.editor.selectedObjects.size} objects selected.</b><br>Properties shown for primary selection.`;
                    fragment.appendChild(multiSelectInfo);
                }
                this.renderEntitySettings(fragment, createPropGroup, createTextInput, createColorInput, createNumberInput, createVec3Inputs);
            }
    
            this.inspectorContent.appendChild(fragment);
        }
        
        renderSceneSettings(fragment, createPropGroup, createColorInput, createNumberInput) {
            const settings = this.app.settings;
            const groupTitle = document.createElement('div');
            groupTitle.className = 'placeholder-text';
            groupTitle.innerHTML = '<b>Scene Settings</b>';
            fragment.appendChild(groupTitle);
            
            const skyboxGroup = createPropGroup('Skybox');
            const select = document.createElement('select');
            select.onchange = (e) => this.editor.updateSceneSetting('skybox', e.target.value);
    
            const noneOption = document.createElement('option');
            noneOption.value = '';
            noneOption.textContent = 'None (Use Background Color)';
            select.appendChild(noneOption);
    
            this.skyboxOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.path;
                option.textContent = opt.name;
                select.appendChild(option);
            });
            select.value = settings.skybox || '';
            skyboxGroup.appendChild(select);
            
            fragment.appendChild(document.createElement('hr'));
            
            const bgGroup = createPropGroup('Background Color');
            const bgColor = settings.backgroundColor ? '#' + new THREE.Color(parseInt(settings.backgroundColor, 16)).getHexString() : '#000000';
            createColorInput(bgGroup, bgColor, (val) => this.editor.updateSceneSetting('backgroundColor', val.replace('#', '0x')));
            
            const fogGroup = createPropGroup('Fog Color');
            const fogColor = settings.fogColor ? '#' + new THREE.Color(parseInt(settings.fogColor, 16)).getHexString() : '#000000';
            createColorInput(fogGroup, fogColor, (val) => this.editor.updateSceneSetting('fogColor', val.replace('#', '0x')));
            
            const fogDistGroup = createPropGroup('Fog Distance (Near / Far)');
            const fogDistContainer = document.createElement('div');
            fogDistContainer.className = 'prop-input-group';
            createNumberInput(fogDistContainer, settings.fogNear || 10, {min: 0, step: 1}, (val) => this.editor.updateSceneSetting('fogNear', val));
            createNumberInput(fogDistContainer, settings.fogFar || 200, {min: 0, step: 1}, (val) => this.editor.updateSceneSetting('fogFar', val));
            fogDistGroup.appendChild(fogDistContainer);
            
            fragment.appendChild(document.createElement('hr'));
    
            const ambientGroup = createPropGroup('Ambient Light');
            const ambientContainer = document.createElement('div');
            ambientContainer.className = 'prop-input-group';
            const ambientColor = settings.ambientLight.color ? '#' + new THREE.Color(parseInt(settings.ambientLight.color, 16)).getHexString() : '#ffffff';
            createColorInput(ambientContainer, ambientColor, (val) => this.editor.updateSceneSetting('ambientLight.color', val.replace('#', '0x')));
            createNumberInput(ambientContainer, settings.ambientLight.intensity || 1, {min: 0, max: 5, step: 0.1}, (val) => this.editor.updateSceneSetting('ambientLight.intensity', val));
            ambientGroup.appendChild(ambientContainer);
        }
        
        renderEntitySettings(fragment, createPropGroup, createTextInput, createColorInput, createNumberInput, createVec3Inputs) {
            const selectedEntity = this.editor.primarySelectedObject;
            if (!selectedEntity || !selectedEntity.userData?.gameEntity?.type) return;
    
            let propertySourceEntity = selectedEntity;
            const originallySelectedType = selectedEntity.userData.gameEntity.type;
            if (originallySelectedType === 'LightTarget') {
                propertySourceEntity = selectedEntity.userData.gameEntity.parentLight;
            }
    
            const entityType = propertySourceEntity.userData.gameEntity.type;
            const def = propertySourceEntity.definition;
            const mesh = selectedEntity.helperMesh || selectedEntity.mesh || selectedEntity.picker || selectedEntity;
    
            if (def && def.name !== undefined) {
                const group = createPropGroup('Name');
                const input = createTextInput(group, def.name, (val) => this.editor.updateSelectedProp('name', null, val));
                if (originallySelectedType === 'LightTarget') input.disabled = true;
            }
        
            fragment.appendChild(document.createElement('hr'));
        
            const posGroup = createPropGroup('Position');
            createVec3Inputs(posGroup, mesh.position, 0.25, (axis, val) => this.editor.updateSelectedProp('position', axis, val));
        
            if (def && def.rotation) {
                const rotGroup = createPropGroup('Rotation (Deg)');
                const eulerRot = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'YXZ');
                const degRot = { x: THREE.MathUtils.radToDeg(eulerRot.x), y: THREE.MathUtils.radToDeg(eulerRot.y), z: THREE.MathUtils.radToDeg(eulerRot.z) };
                const inputs = createVec3Inputs(rotGroup, degRot, 1, (axis, val) => this.editor.updateSelectedProp('rotation', axis, val));
                if (originallySelectedType === 'LightTarget') inputs.querySelectorAll('input').forEach(i => i.disabled = true);
            }
        
            if (def && def.size) {
                if (def.type === 'Plane' || def.type === 'Waterfall') {
                    const widthGroup = createPropGroup('Width');
                    createNumberInput(widthGroup, def.size[0] * mesh.scale.x, { step: 0.25 }, (val) => { this.editor.updateSelectedProp('size', 0, val); });
                    const depthGroup = createPropGroup('Height');
                    createNumberInput(depthGroup, def.size[1] * mesh.scale.y, { step: 0.25 }, (val) => { this.editor.updateSelectedProp('size', 1, val); });
                } else {
                    const sizeGroup = createPropGroup('Size');
                    const displaySize = { x: def.size[0] * mesh.scale.x, y: def.size[1] * mesh.scale.y, z: def.size[2] * mesh.scale.z };
                    createVec3Inputs(sizeGroup, displaySize, 0.25, (axis, val) => {
                        const changes = [];
                        this.editor.selectedObjects.forEach(selEntity => {
                            const selMesh = selEntity.mesh || selEntity.picker || selEntity.helperMesh;
                            if (!selEntity.definition?.size || !selMesh) return;
                            const beforeDef = JSON.parse(JSON.stringify(selEntity.definition));
                            const afterDef = JSON.parse(JSON.stringify(beforeDef));
                            const map = { x: 0, y: 1, z: 2 };
                            afterDef.size[map[axis]] = val / selMesh.scale[axis];
                            changes.push({ entity: selEntity, beforeState: beforeDef, afterState: afterDef });
                        });
                        if (changes.length > 0) {
                            const command = new StateChangeCommand(this.editor, changes);
                            this.editor.undoManager.execute(command);
                        }
                    });
                }
            }
        
            if (def && def.material) {
                fragment.appendChild(document.createElement('hr'));
                const matGroup = createPropGroup('Material Color');
                const initialColor = def.material.color ? '#' + new THREE.Color(parseInt(def.material.color, 16)).getHexString() : '#cccccc';
                createColorInput(matGroup, initialColor, (val) => this.editor.updateSelectedProp('material.color', null, val));
            }
        
            if (entityType === 'Trigger') {
                fragment.appendChild(document.createElement('hr'));
                const msgGroup = createPropGroup('Message');
                createTextInput(msgGroup, def.message || '', val => this.editor.updateSelectedProp('message', null, val));
                const durGroup = createPropGroup('Duration (s)');
                createNumberInput(durGroup, def.duration || 5, { min: 0.1, max: 100, step: 0.1 }, val => this.editor.updateSelectedProp('duration', null, val));
                const colorGroup = createPropGroup('Helper Color');
                const initialColor = def.color ? '#' + new THREE.Color(parseInt(def.color, 16)).getHexString() : '#00ff00';
                createColorInput(colorGroup, initialColor, val => this.editor.updateSelectedProp('color', null, val));
            }
        
            if (entityType === 'DirectionalLight') {
                fragment.appendChild(document.createElement('hr'));
                const lightGroup = createPropGroup('Light Color');
                const initialColor = def.color ? '#' + new THREE.Color(parseInt(def.color, 16)).getHexString() : '#ffffff';
                const colorInput = createColorInput(lightGroup, initialColor, val => this.editor.updateSelectedProp('color', null, val));
                if (originallySelectedType === 'LightTarget') colorInput.disabled = true;
        
                const intensityGroup = createPropGroup('Intensity');
                const intensityInput = createNumberInput(intensityGroup, propertySourceEntity.light.intensity, { min: 0, max: 20, step: 0.1 }, val => this.editor.updateSelectedProp('intensity', null, val));
                if (originallySelectedType === 'LightTarget') intensityInput.disabled = true;
        
                if (originallySelectedType !== 'LightTarget') {
                    const targetGroup = createPropGroup('Target Position');
                    createVec3Inputs(targetGroup, propertySourceEntity.light.target.position, 0.25, (axis, val) => this.editor.updateSelectedProp('targetPosition', axis, val));
                }
            }
        
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.textContent = 'Delete Selected';
            deleteButton.onclick = () => this.editor.actions.deleteSelected();
            fragment.appendChild(deleteButton);
        }
        
        setHelpersVisibility(type, isVisible) {
            this.editor.helperVisibility[type] = isVisible;
        
            if (type === 'SpawnAndDeath') {
                if (this.app.spawnPointHelper) this.app.spawnPointHelper.visible = isVisible;
                if (this.app.deathSpawnPointHelper) this.app.deathSpawnPointHelper.visible = isVisible;
                return;
            }
        
            let entities;
            switch (type) {
                case 'DirectionalLight': entities = this.app.getDirectionalLights(); break;
                case 'Trigger': entities = this.app.getTriggers(); break;
                case 'DeathTrigger': entities = this.app.getDeathTriggers(); break;
                case 'Water': entities = this.app.getWaterVolumes(); break;
                default: entities = [];
            }
        
            entities.forEach(e => {
                if (type === 'DirectionalLight') {
                    if (e.helper) e.helper.visible = isVisible;
                    if (e.targetHelper) e.targetHelper.visible = isVisible;
                } else if (e.helperMesh) {
                    // For water, we toggle the helper box, not the visible surface
                    e.helperMesh.visible = isVisible;
                } else if (e.mesh) {
                    e.mesh.visible = isVisible;
                }
            });
        }
    }