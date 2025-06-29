// src/editor/LevelEditor.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export class LevelEditor {
    constructor(app) {
        this.app = app;
        this.scene = app.scene;
        this.camera = app.camera;
        this.renderer = app.renderer.renderer;
        this.physics = app.physics;
        this.input = app.input;

        this.levelObjects = [];
        this.enemies = [];
        this.triggers = [];
        this.deathTriggers = [];
        this.selectedObject = null;
        this.clipboard = null;

        this.helperVisibility = {
            msgTriggers: true,
            deathTriggers: true,
            lightHelpers: true,
            spawnHelpers: true,
        };
        
        // Internal state for rotation logic
        this._initialLightPos = null;
        this._initialPickerQuat = null;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.onMouseDownHandler = this.onMouseDown.bind(this);
        this.onKeyDownHandler = this.onKeyDown.bind(this);
        this.onContextMenuHandler = (e) => e.preventDefault();

        this.initUI();
        this.initControls();
        this.addEventListeners();
    }

    addEventListeners() {
        this.renderer.domElement.addEventListener('mousedown', this.onMouseDownHandler, false);
        this.renderer.domElement.addEventListener('contextmenu', this.onContextMenuHandler, false);
        document.addEventListener('keydown', this.onKeyDownHandler);
    }

    dispose() {
        this.renderer.domElement.removeEventListener('mousedown', this.onMouseDownHandler, false);
        this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenuHandler, false);
        document.removeEventListener('keydown', this.onKeyDownHandler);
        this.transformControls.dispose();
        this.scene.remove(this.transformControls);
        this.scene.remove(this.selectionBox);
        this.selectionBox.geometry.dispose();
        this.selectionBox.material.dispose();
    }

    initUI() {
        // Toolbar
        document.getElementById('editor-load-btn').onclick = () => document.getElementById('editor-file-input').click();
        document.getElementById('editor-file-input').onchange = (e) => this.loadFile(e);
        document.getElementById('editor-save-btn').onclick = () => this.saveFile();
        document.getElementById('editor-mode-translate').onclick = () => this.setTransformMode('translate');
        document.getElementById('editor-mode-rotate').onclick = () => this.setTransformMode('rotate');
        document.getElementById('editor-mode-scale').onclick = () => this.setTransformMode('scale');

        // Scene Accordion
        document.getElementById('skybox-color-input').oninput = (e) => this.updateSkyboxColor(e.target.value);
        document.getElementById('ambient-color-input').oninput = (e) => this.updateAmbientLight('color', e.target.value);
        document.getElementById('ambient-intensity-input').oninput = (e) => this.updateAmbientLight('intensity', e.target.value);

        // Create Accordion
        document.getElementById('editor-add-box').onclick = () => this.addBox();
        document.getElementById('editor-add-enemy').onclick = () => this.addEnemy();
        document.getElementById('add-dirlight-btn').onclick = () => this.app.addDirectionalLight();
        document.getElementById('editor-add-msg-trigger').onclick = () => this.addMessageTrigger();
        document.getElementById('editor-add-death-trigger').onclick = () => this.addDeathTrigger();
        document.getElementById('editor-set-spawn').onclick = () => this.setSpawnPointToCamera();
        document.getElementById('editor-set-death-spawn').onclick = () => this.setDeathSpawnPointToCamera();

        // View Options Accordion
        document.getElementById('view-toggle-msg-triggers').onchange = (e) => this.setHelpersVisibility('msgTriggers', e.target.checked);
        document.getElementById('view-toggle-death-triggers').onchange = (e) => this.setHelpersVisibility('deathTriggers', e.target.checked);
        document.getElementById('view-toggle-light-helpers').onchange = (e) => this.setHelpersVisibility('lightHelpers', e.target.checked);
        document.getElementById('view-toggle-spawn-helpers').onchange = (e) => this.setHelpersVisibility('spawnHelpers', e.target.checked);

        // Outliner
        this.outlinerList = document.getElementById('outliner-list');
        this.outlinerList.onclick = (e) => {
            const item = e.target.closest('.outliner-item');
            if (item) this.selectByUUID(item.dataset.uuid);
        };

        // Properties Panel
        this.propertiesAccordion = document.getElementById('properties-accordion');
        this.propertiesContent = document.getElementById('properties-content');
        document.getElementById('editor-delete-btn').onclick = () => this.deleteSelected();
    }

    initControls() {
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.input.enabled = !event.value;
            
            if (event.value) {
                if (this.selectedObject?.userData?.gameEntity?.type === 'DirectionalLight' && this.transformControls.mode === 'rotate') {
                    this._initialLightPos = this.selectedObject.light.position.clone();
                    this._initialPickerQuat = this.selectedObject.picker.quaternion.clone();
                }
            } else {
                this._initialLightPos = null;
                this._initialPickerQuat = null;
                if (this.selectedObject?.transformControls?.mode === 'scale') {
                    const attachedMesh = this.selectedObject.mesh || this.selectedObject;
                    const def = this.selectedObject.definition;
                    if (def?.size) {
                        def.size[0] *= attachedMesh.scale.x;
                        def.size[1] *= attachedMesh.scale.y;
                        if (def.size.length > 2) def.size[2] *= attachedMesh.scale.z;
                        attachedMesh.scale.set(1, 1, 1);
                        this.applyDefinition(this.selectedObject);
                        this.updatePropertiesPanel();
                    }
                }
            }
        });
        
        this.transformControls.addEventListener('objectChange', () => {
            if (this.selectedObject) {
                this.syncObjectTransforms();
                this.updatePropertiesPanel();
            }
        });
        this.scene.add(this.transformControls);

        this.selectionBox = new THREE.BoxHelper();
        this.selectionBox.material.depthTest = false;
        this.selectionBox.material.transparent = true;
        this.selectionBox.visible = false;
        this.scene.add(this.selectionBox);
    }
    
    onKeyDown(event) {
        if (event.target.tagName === 'INPUT' || this.transformControls.dragging) return;

        if (event.ctrlKey) {
            switch (event.code) {
                case 'KeyC': event.preventDefault(); this.copySelected(); break;
                case 'KeyV': event.preventDefault(); this.pasteFromClipboard(); break;
            }
        } else {
            switch (event.code) {
                case 'KeyT': this.setTransformMode('translate'); break;
                case 'KeyR': this.setTransformMode('rotate'); break;
                case 'KeyS': this.setTransformMode('scale'); break;
                case 'Delete':
                case 'Backspace': this.deleteSelected(); break;
            }
        }
    }

    onMouseDown(event) {
        if (event.button !== 0 || this.transformControls.dragging || this.input.isClickOnUI(event.clientX, event.clientY)) return;
        
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const pickableMeshes = this.levelObjects.map(o => o.mesh)
            .concat(this.enemies.map(e => e.mesh))
            .concat(this.app.directionalLights.map(l => l.picker))
            .concat(this.triggers.map(t => t.mesh))
            .concat(this.deathTriggers.map(t => t.mesh))
            .concat(this.app.spawnPointHelper ? [this.app.spawnPointHelper] : [])
            .concat(this.app.deathSpawnPointHelper ? [this.app.deathSpawnPointHelper] : []);
            
        const intersects = this.raycaster.intersectObjects(pickableMeshes.filter(m => m.visible), true);
        const validIntersects = intersects.filter(i => i.object.userData.gameEntity?.entity);
        
        if (validIntersects.length > 0) {
            const entity = validIntersects[0].object.userData.gameEntity.entity;
            if (entity.definition?.editorSelectable === false) {
                 this.deselect();
            } else {
                 this.select(entity);
            }
        } else {
            this.deselect();
        }
    }

    // --- Selection and UI Management ---

    select(entity) {
        if (!entity || this.selectedObject === entity) return;
        this.deselect();
        
        this.selectedObject = entity;
        const entityType = entity.userData?.gameEntity?.type;
        let objectToAttach = entity.mesh || entity.picker || entity;

        if (entityType === 'DirectionalLight') entity.picker.material.visible = true;

        this.transformControls.attach(objectToAttach);
        this.selectionBox.setFromObject(objectToAttach);
        this.selectionBox.visible = true;
        this.propertiesAccordion.style.display = 'block';
        this.propertiesAccordion.open = true;
        
        this.updatePropertiesPanel();
        this.updateOutliner();
        
        const isEnemy = entity.isDead !== undefined;
        const isTrigger = entityType === 'Trigger' || entityType === 'DeathTrigger';
        const canRotate = !(entityType === 'SpawnPoint' || entityType === 'DeathSpawnPoint' || isTrigger);
        const canScale = !(entityType === 'SpawnPoint' || entityType === 'DeathSpawnPoint' || entityType === 'DirectionalLight' || isEnemy || isTrigger);
        
        document.getElementById('editor-mode-rotate').disabled = !canRotate;
        document.getElementById('editor-mode-scale').disabled = !canScale;

        if (!canRotate && this.transformControls.getMode() === 'rotate') this.setTransformMode('translate');
        if (!canScale && this.transformControls.getMode() === 'scale') this.setTransformMode('translate');
    }

    deselect() {
        if (!this.selectedObject) return;
        
        if (this.selectedObject.userData?.gameEntity?.type === 'DirectionalLight') {
            this.selectedObject.picker.material.visible = false;
        }

        this.selectedObject = null;
        this.transformControls.detach();
        this.selectionBox.visible = false;
        this.propertiesAccordion.style.display = 'none';
        this.updateOutliner();
        
        document.getElementById('editor-mode-rotate').disabled = false;
        document.getElementById('editor-mode-scale').disabled = false;
    }

    selectByUUID(uuid) {
        const allEntities = [
            ...this.app.levelObjects, ...this.app.enemies, ...this.app.directionalLights,
            ...this.triggers, ...this.deathTriggers,
            this.app.spawnPointHelper, this.app.deathSpawnPointHelper,
        ].filter(Boolean);

        const entityToSelect = allEntities.find(e => (e.mesh || e.picker || e).uuid === uuid);
        if (entityToSelect) this.select(entityToSelect);
    }
    
    updateOutliner() {
        this.outlinerList.innerHTML = '';
        const createItem = (entity, name, uuid, prefix = '') => {
            const item = document.createElement('div');
            item.className = 'outliner-item';
            item.textContent = `${prefix} ${name}`;
            item.dataset.uuid = uuid;
            if (entity === this.selectedObject) item.classList.add('selected');
            this.outlinerList.appendChild(item);
        };

        if (this.app.spawnPointHelper) createItem(this.app.spawnPointHelper, 'Initial Spawn', this.app.spawnPointHelper.uuid, '[P]');
        if (this.app.deathSpawnPointHelper) createItem(this.app.deathSpawnPointHelper, 'Death Spawn', this.app.deathSpawnPointHelper.uuid, '[P]');
        this.app.directionalLights.forEach((l, i) => createItem(l, `Directional Light ${i+1}`, l.picker.uuid, '[L]'));
        this.app.levelObjects.forEach(o => createItem(o, o.definition.name || 'Object', o.mesh.uuid, '[G]'));
        this.app.enemies.forEach(e => createItem(e, e.name || 'Enemy', e.mesh.uuid, '[E]'));
        this.triggers.forEach((t, i) => createItem(t, t.definition.name || `Trigger ${i+1}`, t.mesh.uuid, '[T]'));
        this.deathTriggers.forEach((t, i) => createItem(t, t.definition.name || `Death Zone ${i+1}`, t.mesh.uuid, '[D]'));
    }
    
    updatePropertiesPanel() {
        if (!this.selectedObject) {
            this.propertiesAccordion.style.display = 'none';
            return;
        }
        this.propertiesContent.innerHTML = '';
        const entity = this.selectedObject;
        const entityType = entity.userData?.gameEntity?.type;
        
        if (!entityType) return;
        
        const fragment = document.createDocumentFragment();

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
                input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        updateValue(e.target.value);
                        e.target.blur();
                    }
                };
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
                 const updateValue = (valStr) => callback(index, parseFloat(valStr));
                 input.onchange = (e) => updateValue(e.target.value);
                 input.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        updateValue(e.target.value);
                        e.target.blur();
                    }
                 };
                 group.appendChild(input);
             });
        };
        
        const createRangeInput = (label, value, min, max, step, callback) => {
            fragment.appendChild(document.createElement('label')).textContent = label;
            const input = fragment.appendChild(document.createElement('input'));
            input.type = 'range';
            input.min = min; input.max = max; input.step = step;
            input.value = value;
            input.oninput = (e) => callback(parseFloat(e.target.value));
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
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    updateValue(e.target.value);
                    e.target.blur();
                }
            };
        };
        
        if (entityType === 'Trigger' || entityType === 'DeathTrigger') {
            const def = entity.definition;
            createTextInput('Name', def.name || '', val => this.updateSelectedProp('name', null, val));
            createVec3Inputs('Position', entity.mesh.position, (axis, val) => this.updateSelectedProp('position', axis, val));
            createSizeInputs('Size', def.size, (index, val) => this.updateSelectedProp('size', index, val));
            if (entityType === 'Trigger') {
                fragment.appendChild(document.createElement('hr'));
                createTextInput('Message', def.message || '', val => this.updateSelectedProp('message', null, val));
                createColorInput('Color', entity.mesh.material.color, val => this.updateSelectedProp('color', null, val));
            }
        } else if (entityType === 'SpawnPoint' || entityType === 'DeathSpawnPoint') {
            createVec3Inputs('Position', entity.position, (axis, val) => this.updateSelectedProp('position', axis, val));
        } else if (entityType === 'DirectionalLight') {
             createColorInput('Color', entity.light.color, val => this.updateSelectedProp('color', null, val));
             createRangeInput('Intensity', entity.light.intensity, 0, 10, 0.1, val => this.updateSelectedProp('intensity', null, val));
             createVec3Inputs('Position (Direction)', entity.light.position, (axis, val) => this.updateSelectedProp('position', axis, val));
        } else { // Generic Object or Enemy
            const def = entity.definition;
            const mesh = entity.mesh;
            fragment.appendChild(document.createElement('label')).textContent = `Name: ${def.name || def.type}`;
            createVec3Inputs('Position', mesh.position, (axis, val) => this.updateSelectedProp('position', axis, val));
            if (entity.isDead === undefined && def.type !== 'Plane') {
                 const eulerRot = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'YXZ');
                 const degRot = { x: THREE.MathUtils.radToDeg(eulerRot.x), y: THREE.MathUtils.radToDeg(eulerRot.y), z: THREE.MathUtils.radToDeg(eulerRot.z) };
                 createVec3Inputs('Rotation', degRot, (axis, val) => this.updateSelectedProp('rotation', axis, val));
            }
            if (def.size) createSizeInputs('Size', def.size, (index, val) => this.updateSelectedProp('size', index, val));
        }
        this.propertiesContent.appendChild(fragment);
    }
    
    // --- Data Manipulation ---

    updateSelectedProp(prop, key, value) {
        if (!this.selectedObject) return;
        const entity = this.selectedObject;
        const entityType = entity.userData?.gameEntity?.type;
        const def = entity.definition;

        if (entityType === 'Trigger' || entityType === 'DeathTrigger') {
            const mesh = entity.mesh;
            if (prop === 'name') def.name = value;
            if (prop === 'position') mesh.position[key] = value;
            if (prop === 'size') def.size[key] = value;
            if (entityType === 'Trigger') {
                if (prop === 'message') def.message = value;
                if (prop === 'color') { mesh.material.color.set(value); def.color = value.replace('#', '0x'); }
            }
            this.applyDefinition(entity);
        } else if (entityType === 'SpawnPoint' || entityType === 'DeathSpawnPoint') {
            if (prop === 'position') entity.position[key] = value;
        } else if (entityType === 'DirectionalLight') {
            if (prop === 'color') { entity.light.color.set(value); def.color = value.replace('#', '0x'); }
            if (prop === 'intensity') { entity.light.intensity = value; def.intensity = value; }
            if (prop === 'position') { entity.light.position[key] = value; entity.picker.position[key] = value; def.position[key] = value; entity.helper.update(); }
        } else { // Generic Object / Enemy
            const mesh = entity.mesh;
            if (prop === 'position') mesh.position[key] = value;
            if (prop === 'rotation') {
                const euler = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'YXZ');
                euler[key] = THREE.MathUtils.degToRad(value);
                mesh.quaternion.setFromEuler(euler);
            }
            if (prop === 'size') def.size[key] = value;
            this.applyDefinition(entity);
        }
        this.syncObjectTransforms();
        this.updateOutliner();
    }
    
    applyDefinition(obj) {
        const type = obj.userData?.gameEntity?.type;
        if (type === 'SpawnPoint' || type === 'DeathSpawnPoint') {
            this.selectionBox.setFromObject(obj);
            return;
        }

        const def = obj.definition;
        const mesh = obj.mesh;
        const body = obj.body;
        
        mesh.position.set(def.position.x, def.position.y, def.position.z);
        if (def.rotation && obj.isDead === undefined) {
             mesh.rotation.set(
                THREE.MathUtils.degToRad(def.rotation.x || 0),
                THREE.MathUtils.degToRad(def.rotation.y || 0),
                THREE.MathUtils.degToRad(def.rotation.z || 0)
            );
        }

        if((type === 'Trigger' || type === 'DeathTrigger') && def.size) {
            mesh.geometry.dispose();
            mesh.geometry = new THREE.BoxGeometry(...def.size);
        } else if(def.size && def.type === 'Box' && body?.shapes[0]) {
            const halfExtents = new CANNON.Vec3(def.size[0]/2, def.size[1]/2, def.size[2]/2);
            body.shapes[0].halfExtents.copy(halfExtents);
            body.shapes[0].updateConvexPolyhedronRepresentation();
            body.updateBoundingRadius();
            mesh.geometry.dispose();
            mesh.geometry = new THREE.BoxGeometry(...def.size);
        }
        
        this.syncObjectTransforms();
        this.selectionBox.setFromObject(mesh);
    }
    
    syncObjectTransforms() {
        if (!this.selectedObject) return;
        
        const entity = this.selectedObject;
        const entityType = entity.userData?.gameEntity?.type;
        
        if (entityType === 'Trigger' || entityType === 'DeathTrigger') {
            entity.definition.position = { x: entity.mesh.position.x, y: entity.mesh.position.y, z: entity.mesh.position.z };
        } else if (entityType === 'SpawnPoint') {
            this.app.spawnPoint.x = entity.position.x;
            this.app.spawnPoint.y = entity.position.y;
            this.app.spawnPoint.z = entity.position.z;
        } else if (entityType === 'DeathSpawnPoint') {
            this.app.deathSpawnPoint.x = entity.position.x;
            this.app.deathSpawnPoint.y = entity.position.y;
            this.app.deathSpawnPoint.z = entity.position.z;
        } else if (entityType === 'DirectionalLight') {
            const picker = entity.picker;
            const light = entity.light;

            if (this.transformControls.mode === 'rotate' && this.transformControls.dragging && this._initialLightPos) {
                const deltaQuat = picker.quaternion.clone().multiply(this._initialPickerQuat.clone().invert());
                light.position.copy(this._initialLightPos).applyQuaternion(deltaQuat);
                picker.position.copy(light.position);
            } else {
                light.position.copy(picker.position);
            }
            
            light.target.position.set(0,0,0);
            entity.definition.position = { x: light.position.x, y: light.position.y, z: light.position.z };
            entity.helper.update();

            if (this.selectedObject === entity) this.selectionBox.setFromObject(picker);
        } else {
            if (entity.body) {
                entity.body.position.copy(entity.mesh.position);
                entity.body.quaternion.copy(entity.mesh.quaternion);
            }
        }
    }
    
    deleteSelected() {
        if (!this.selectedObject) return;
        const entity = this.selectedObject;
        const entityType = entity.userData.gameEntity.type;
        
        if (entityType === 'SpawnPoint' || entityType === 'DeathSpawnPoint') return;

        let list, index;
        switch (entityType) {
            case 'Trigger':       list = this.triggers; break;
            case 'DeathTrigger':  list = this.deathTriggers; break;
            case 'DirectionalLight': this.app.removeDirectionalLight(entity); break;
            case 'Enemy':         list = this.enemies; break;
            default:              list = this.levelObjects; break;
        }

        if (list) {
            index = list.findIndex(item => item === entity);
            if (index > -1) list.splice(index, 1);
        }

        if (entity.mesh) {
            this.scene.remove(entity.mesh);
            if(entity.mesh.geometry) entity.mesh.geometry.dispose();
            if(entity.mesh.material) entity.mesh.material.dispose();
        }
        if (entity.body) this.physics.queueForRemoval(entity.body);
        
        this.deselect();
        this.updateOutliner();
    }
    
    copySelected() {
        if (!this.selectedObject) return;
        
        const entity = this.selectedObject;
        const entityType = entity.userData?.gameEntity?.type;

        if (['Object', 'Enemy', 'Trigger', 'DeathTrigger'].includes(entityType)) {
            this.syncObjectTransforms(); 
            if (entityType === 'Object') {
                const rot = new THREE.Euler().setFromQuaternion(entity.mesh.quaternion, 'YXZ');
                entity.definition.rotation = {x: THREE.MathUtils.radToDeg(rot.x), y: THREE.MathUtils.radToDeg(rot.y), z: THREE.MathUtils.radToDeg(rot.z)};
            }
            this.clipboard = JSON.parse(JSON.stringify(entity.definition));
            if (!this.clipboard.type) this.clipboard.type = entityType;
        } else {
            this.clipboard = null;
        }
    }

    pasteFromClipboard() {
        if (!this.clipboard) return;

        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(15));
        
        const newDef = JSON.parse(JSON.stringify(this.clipboard));
        newDef.position = { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z };
        newDef.name = `${newDef.name || newDef.type}_copy`;

        let newEntity;
        switch(newDef.type) {
            case 'Dummy':         newEntity = this.app.levelLoader.createEnemy(newDef); this.enemies.push(newEntity); break;
            case 'Trigger':       newEntity = this.app.createTrigger(newDef); this.triggers.push(newEntity); break;
            case 'DeathTrigger':  newEntity = this.app.createDeathTrigger(newDef); this.deathTriggers.push(newEntity); break;
            default:              newEntity = this.app.levelLoader.createObject(newDef); this.levelObjects.push(newEntity); break;
        }
        
        if (newEntity) this.select(newEntity);
    }
    
    addBox() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(10));
        const boxData = {
            type: "Box", name: `Box_${Date.now()}`, size: [2, 2, 2],
            position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
            rotation: { x: 0, y: 0, z: 0 },
            material: { color: "0xcccccc" }, physics: { mass: 0 }
        };
        const newObj = this.app.levelLoader.createObject(boxData);
        this.levelObjects.push(newObj);
        this.select(newObj);
    }
    
    addEnemy() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(10));
        const enemyData = { type: "Dummy", position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z } };
        const newEnemy = this.app.levelLoader.createEnemy(enemyData);
        this.enemies.push(newEnemy);
        this.select(newEnemy);
    }

    addMessageTrigger() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(10));
        const triggerData = {
            type: "Trigger", name: `MessageTrigger_${Date.now()}`, size: [5, 5, 5],
            position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
            message: "This is a test message.",
            duration: 5,
            color: "0x00ff00"
        };
        const newTrigger = this.app.createTrigger(triggerData);
        this.triggers.push(newTrigger);
        this.select(newTrigger);
    }

    addDeathTrigger() {
        const lookDir = new THREE.Vector3();
        this.camera.getWorldDirection(lookDir);
        const spawnPos = new THREE.Vector3().copy(this.camera.position).add(lookDir.multiplyScalar(10));
        const triggerData = {
            type: "DeathTrigger", name: `DeathZone_${Date.now()}`, size: [10, 2, 10],
            position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z }
        };
        const newTrigger = this.app.createDeathTrigger(triggerData);
        this.deathTriggers.push(newTrigger);
        this.select(newTrigger);
    }

    loadFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try { this.app.loadLevel(JSON.parse(e.target.result)); } 
            catch (err) { alert("Invalid level file."); }
        };
        reader.readAsText(file);
    }

    saveFile() {
        [...this.levelObjects, ...this.enemies, ...this.triggers, ...this.deathTriggers].forEach(obj => {
            obj.definition.position = {x: obj.mesh.position.x, y: obj.mesh.position.y, z: obj.mesh.position.z};
            if(obj.definition.rotation) {
                const rot = new THREE.Euler().setFromQuaternion(obj.mesh.quaternion, 'YXZ');
                obj.definition.rotation = {x: THREE.MathUtils.radToDeg(rot.x), y: THREE.MathUtils.radToDeg(rot.y), z: THREE.MathUtils.radToDeg(rot.z)};
            }
        });

        const levelData = {
            name: "Custom Level",
            spawnPoint: this.app.spawnPoint,
            deathSpawnPoint: this.app.deathSpawnPoint,
            settings: this.app.settings,
            objects: this.app.levelObjects.map(obj => obj.definition),
            enemies: this.app.enemies.map(enemy => enemy.definition),
            triggers: this.triggers.map(t => t.definition),
            deathTriggers: this.deathTriggers.map(t => t.definition)
        };
        
        const blob = new Blob([JSON.stringify(levelData, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'custom-level.json';
        a.click();
        URL.revokeObjectURL(a.href);
    }
    
    updateSkyboxColor(color) {
        this.app.scene.background = new THREE.Color(color);
        this.app.settings.backgroundColor = color.replace('#', '0x');
    }
    
    updateAmbientLight(prop, value) {
        const light = this.app.ambientLight;
        const setting = this.app.settings.ambientLight;
        if (prop === 'color') { light.color.set(value); setting.color = value.replace('#', '0x'); }
        if (prop === 'intensity') { light.intensity = parseFloat(value); setting.intensity = parseFloat(value); }
    }

    setTransformMode(mode) {
        if (this.transformControls.object) {
            this.transformControls.setMode(mode);
            ['translate', 'rotate', 'scale'].forEach(m => {
                document.getElementById(`editor-mode-${m}`).classList.toggle('active', m === mode);
            });
        }
    }

    setSpawnPointToCamera() { this.camera.getWorldPosition(this.app.spawnPointHelper.position); this.syncObjectTransforms(); }
    setDeathSpawnPointToCamera() { this.camera.getWorldPosition(this.app.deathSpawnPointHelper.position); this.syncObjectTransforms(); }
    
    setLevelData(levelObjects, enemies, triggers, deathTriggers) {
        this.levelObjects = levelObjects;
        this.enemies = enemies;
        this.triggers = triggers || [];
        this.deathTriggers = deathTriggers || [];
        this.deselect();
        this.updateOutliner();
        
        const settings = this.app.settings;
        if (!settings) return;
        document.getElementById('skybox-color-input').value = '#' + new THREE.Color(parseInt(settings.backgroundColor || "0x000000", 16)).getHexString();
        document.getElementById('ambient-color-input').value = '#' + new THREE.Color(parseInt(settings.ambientLight.color, 16)).getHexString();
        document.getElementById('ambient-intensity-input').value = settings.ambientLight.intensity;

        // Apply initial visibility from UI checkboxes
        this.setHelpersVisibility('msgTriggers', document.getElementById('view-toggle-msg-triggers').checked);
        this.setHelpersVisibility('deathTriggers', document.getElementById('view-toggle-death-triggers').checked);
        this.setHelpersVisibility('lightHelpers', document.getElementById('view-toggle-light-helpers').checked);
        this.setHelpersVisibility('spawnHelpers', document.getElementById('view-toggle-spawn-helpers').checked);
    }

    setHelpersVisibility(type, isVisible) {
        this.helperVisibility[type] = isVisible;
        switch (type) {
            case 'msgTriggers':   this.triggers.forEach(t => t.mesh.visible = isVisible); break;
            case 'deathTriggers': this.deathTriggers.forEach(t => t.mesh.visible = isVisible); break;
            case 'lightHelpers':  this.app.directionalLights.forEach(l => l.helper.visible = isVisible); break;
            case 'spawnHelpers':
                if (this.app.spawnPointHelper) this.app.spawnPointHelper.visible = isVisible;
                if (this.app.deathSpawnPointHelper) this.app.deathSpawnPointHelper.visible = isVisible;
                break;
        }
    }
    
    update(deltaTime) {
        if (this.transformControls.dragging || !this.input.enabled) {
            this.input.update();
            return;
        }

        const moveSpeed = 50 * deltaTime;
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        const right = new THREE.Vector3().crossVectors(this.camera.up, forward).negate();
        
        if (this.input.keys['KeyW']) this.camera.position.addScaledVector(forward, moveSpeed);
        if (this.input.keys['KeyS']) this.camera.position.addScaledVector(forward, -moveSpeed);
        if (this.input.keys['KeyA']) this.camera.position.addScaledVector(right, -moveSpeed);
        if (this.input.keys['KeyD']) this.camera.position.addScaledVector(right, moveSpeed);
        if (this.input.keys['Space']) this.camera.position.y += moveSpeed;
        if (this.input.keys['ShiftLeft']) this.camera.position.y -= moveSpeed;
        
        if (this.input.mouse.rightClick && !this.input.isClickOnUI(this.input.mouse.screenX, this.input.mouse.screenY)) {
            const euler = new THREE.Euler(0, 0, 0, 'YXZ');
            euler.setFromQuaternion(this.camera.quaternion);
            euler.y -= this.input.mouse.movementX * 0.002;
            euler.x -= this.input.mouse.movementY * 0.002;
            euler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, euler.x));
            this.camera.quaternion.setFromEuler(euler);
        }

        this.input.update();
    }
}