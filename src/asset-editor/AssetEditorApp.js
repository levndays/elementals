import * as THREE from 'three';
import { Renderer } from '../core/Renderer.js';
import { InputManager } from '../core/InputManager.js';
import { ModelEditorUI } from './ModelEditorUI.js';
import { EditorCamera } from './EditorCamera.js';
import { AssetEditorControls } from './AssetEditorControls.js';
import { AssetEditorActions } from './AssetEditorActions.js';
import { UndoManager } from './UndoManager.js';
import { AssetContext } from './AssetContext.js';
import { AnimationManager } from './AnimationManager.js';

export class AssetEditorApp {
    constructor() {
        this.clock = new THREE.Clock();
        const canvas = document.getElementById('editor-canvas');
        this.renderer = new Renderer(canvas);
        this.input = new InputManager();

        this.scene = this.renderer.scene;
        this.camera = this.renderer.camera;

        this.gridHelper = null;
        
        this.selectedObjects = new Set();
        this.primarySelectedObject = null;
        this.selectionGroup = new THREE.Group();
        this.scene.add(this.selectionGroup);
    }

    async init() {
        this.scene.background = new THREE.Color(0x333333);
        this.camera.position.set(0, 1.5, 5);
        this.camera.lookAt(0, 0, 0);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(5, 10, 7.5);
        this.scene.add(dirLight);

        this.gridHelper = new THREE.GridHelper(50, 50, 0xcccccc, 0x888888);
        this.scene.add(this.gridHelper);

        // Core editor components
        this.assetContext = new AssetContext(this.scene);
        this.undoManager = new UndoManager(this);
        this.actions = new AssetEditorActions(this);
        this.controls = new AssetEditorControls(this);
        this.ui = new ModelEditorUI(this);
        this.cameraController = new EditorCamera(this);
        this.animationManager = new AnimationManager(this.assetContext.assetRoot);


        this.renderer.renderer.setAnimationLoop(() => this.animate());
    }
    
    select(object) {
        this.deselect();
        this.addToSelection(object);
    }

    addToSelection(object) {
        if (!object || this.selectedObjects.has(object)) return;
        this.selectedObjects.add(object);
        this.primarySelectedObject = object;
        this.controls.updateSelection();
        this.ui.updateOnSelectionChange();
    }

    removeFromSelection(object) {
        if (!object || !this.selectedObjects.has(object)) return;
        this.selectedObjects.delete(object);
        if (this.primarySelectedObject === object) {
            this.primarySelectedObject = this.selectedObjects.size > 0 ? this.selectedObjects.values().next().value : null;
        }
        this.controls.updateSelection();
        this.ui.updateOnSelectionChange();
    }

    deselect() {
        if (this.selectedObjects.size === 0) return;
        this.selectedObjects.clear();
        this.primarySelectedObject = null;
        this.controls.updateSelection();
        this.ui.updateOnSelectionChange();
    }

    animate() {
        const deltaTime = this.clock.getDelta();
        
        this.cameraController.update(deltaTime);
        this.controls.update();
        this.animationManager.update(deltaTime);
        this.renderer.render();
    }
}