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
import { ViewModelCamera } from './ViewModelCamera.js';
import { ViewModelGuide } from './ViewModelGuide.js';
import { EDITOR_LAYERS } from './layers.js';

export class AssetEditorApp {
    constructor() {
        this.clock = new THREE.Clock();
        this.container = document.getElementById('asset-editor-container');
        const canvas = document.getElementById('editor-canvas');
        this.renderer = new Renderer(canvas);
        this.input = new InputManager();

        this.scene = this.renderer.scene;
        this.viewModelScene = new THREE.Scene();
        this.camera = this.renderer.camera;

        this.gridHelper = null;
        this.viewModelGuide = null;
        this.ambientLight = null;
        this.dirLight = null;
        
        this.selectedObjects = new Set();
        this.primarySelectedObject = null;
        this.selectionGroup = new THREE.Group();
        this.scene.add(this.selectionGroup);

        this.editorState = 'EDITING';
        this.editorBackgroundColor = new THREE.Color(0x333333);
        this.testBackgroundColor = new THREE.Color(0x87CEEB);
    }

    async init() {
        this.scene.background = this.editorBackgroundColor;
        this.camera.position.set(0, 1.5, 5);
        this.camera.lookAt(0, 0, 0);

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(this.ambientLight);
        
        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.dirLight.position.set(5, 10, 7.5);
        this.scene.add(this.dirLight);

        this.gridHelper = new THREE.GridHelper(50, 50, 0xcccccc, 0x888888);
        this.scene.add(this.gridHelper);

        this.viewModelGuide = new ViewModelGuide();
        this.scene.add(this.viewModelGuide);

        this.assetContext = new AssetContext(this.scene);
        this.undoManager = new UndoManager(this);
        this.actions = new AssetEditorActions(this);
        this.controls = new AssetEditorControls(this);
        this.ui = new ModelEditorUI(this);
        
        this.editorCameraController = new EditorCamera(this);
        this.viewModelCameraController = new ViewModelCamera(this);
        
        this.animationManager = new AnimationManager(this);
        
        document.addEventListener('keydown', (e) => this._onKeyDown(e));
        this.renderer.renderer.setAnimationLoop(() => this.animate());
    }

    _onKeyDown(event) {
        if (event.target.tagName === 'INPUT' || this.controls.transformControls.dragging) return;
    
        const ctrlOrMeta = event.ctrlKey || event.metaKey;
        let handled = false;
    
        if (ctrlOrMeta) {
            switch (event.code) {
                case 'KeyN': this.actions._loadDataWithUndo(null); handled = true; break;
                case 'KeyO': this.ui.openAsset(); handled = true; break;
                case 'KeyS': this.ui.saveAsset(); handled = true; break;
                case 'KeyT': this.enterViewModelTest(); handled = true; break;
                case 'KeyZ': this.undoManager.undo(); handled = true; break;
                case 'KeyY': this.undoManager.redo(); handled = true; break;
            }
        } else {
            switch (event.code) {
                case 'KeyT': this.controls.setMode('translate'); handled = true; break;
                case 'KeyR': this.controls.setMode('rotate'); handled = true; break;
                case 'KeyS': this.controls.setMode('scale'); handled = true; break;
                case 'Delete':
                case 'Backspace':
                    if (this.ui.selectedKeyframeInfo) this.actions.deleteSelectedKeyframe();
                    else this.actions.deleteSelected();
                    handled = true;
                    break;
            }
        }
    
        if (handled) {
            event.preventDefault();
        }
    }

    enterViewModelTest() {
        if (this.editorState === 'TESTING') return;
        this.editorState = 'TESTING';

        this.deselect();
        this.controls.transformControls.enabled = false;
        
        this.scene.background = this.testBackgroundColor;
        this.gridHelper.visible = false;
        this.viewModelGuide.setVisible(false);
        
        this.viewModelCameraController.start();

        const asset = this.assetContext.assetRoot;
        asset.traverse(child => {
            child.layers.set(EDITOR_LAYERS.VIEWMODEL);
        });

        // Move lights and camera into the dedicated viewmodel scene
        this.scene.remove(this.ambientLight, this.dirLight);
        this.viewModelScene.add(this.ambientLight, this.dirLight, this.camera);
        
        // Ensure lights are on the same layer as the viewmodel objects
        this.ambientLight.layers.set(EDITOR_LAYERS.VIEWMODEL);
        this.dirLight.layers.set(EDITOR_LAYERS.VIEWMODEL);
        
        this.camera.add(asset); // Parent asset to camera
        asset.position.set(0.25, -0.4, -0.8);
        asset.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        
        document.getElementById('viewmodel-test-overlay').style.display = 'flex';
        this.container.classList.add('is-testing');
    }

    exitViewModelTest() {
        if (this.editorState !== 'TESTING') return;
        this.editorState = 'EDITING';
        
        this.viewModelCameraController.stop();

        const asset = this.assetContext.assetRoot;
        
        // Move everything back to the main scene
        this.camera.remove(asset);
        this.viewModelScene.remove(this.ambientLight, this.dirLight, this.camera);
        this.scene.add(asset, this.ambientLight, this.dirLight);

        asset.traverse(child => {
            child.layers.set(EDITOR_LAYERS.DEFAULT);
        });
        // Reset light layers
        this.ambientLight.layers.set(EDITOR_LAYERS.DEFAULT);
        this.dirLight.layers.set(EDITOR_LAYERS.DEFAULT);
        
        asset.position.set(0, 0, 0);
        asset.quaternion.identity();

        this.scene.background = this.editorBackgroundColor;
        this.controls.transformControls.enabled = true;
        this.gridHelper.visible = document.getElementById('view-toggle-grid').checked;
        this.viewModelGuide.setVisible(document.getElementById('view-toggle-viewmodel-guide').checked);
        
        this.animationManager.resetToIdle();
        document.getElementById('viewmodel-test-overlay').style.display = 'none';
        this.container.classList.remove('is-testing');
    }
    
    select(object) {
        if (this.editorState !== 'EDITING') return;
        this.deselect();
        this.addToSelection(object);
    }

    addToSelection(object) {
        if (!object || this.selectedObjects.has(object) || this.editorState !== 'EDITING') return;
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
        
        if (this.editorState === 'EDITING') {
            this.editorCameraController.update(deltaTime);
            this.controls.update();
        } else { // 'TESTING'
            this.viewModelCameraController.update(deltaTime);
        }
        
        this.animationManager.update(deltaTime);
        
        const webglRenderer = this.renderer.renderer;
        
        if (this.editorState === 'TESTING') {
            webglRenderer.autoClear = false;
            webglRenderer.clear();
            
            // Render the main scene (background color only)
            this.camera.layers.set(EDITOR_LAYERS.DEFAULT);
            webglRenderer.render(this.scene, this.camera);
            
            webglRenderer.clearDepth();

            // Render the viewmodel scene
            this.camera.layers.set(EDITOR_LAYERS.VIEWMODEL);
            webglRenderer.render(this.viewModelScene, this.camera);

            webglRenderer.autoClear = true;
        } else {
            this.camera.layers.set(EDITOR_LAYERS.DEFAULT);
            webglRenderer.render(this.scene, this.camera);
        }
        
        this.camera.layers.set(EDITOR_LAYERS.DEFAULT);
    }
}