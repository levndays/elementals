import * as THREE from 'three';

export class StateChangeCommand {
    constructor(app, changes) {
        this.app = app;
        
        const changeArray = Array.isArray(changes) ? changes : [{ entity: changes.entity || changes, ...changes }];

        this.changes = changeArray.map(c => {
            const cloneState = (state) => {
                if (!state) return null;
                const cloned = {};
                if (state.position) cloned.position = state.position.clone();
                if (state.quaternion) cloned.quaternion = state.quaternion.clone();
                if (state.scale) cloned.scale = state.scale.clone();
                if (state.name !== undefined) cloned.name = state.name;
                if (state.geometry !== undefined) cloned.geometry = { ...state.geometry };
                
                if (state.material) {
                    cloned.material = {};
                    for (const key in state.material) {
                        if (key === 'color' && state.material.color.isColor) {
                            cloned.material.color = state.material.color.getHex();
                        } else {
                            cloned.material[key] = state.material[key];
                        }
                    }
                }
                return cloned;
            };

            return {
                entity: c.entity,
                beforeState: cloneState(c.beforeState),
                afterState: cloneState(c.afterState)
            };
        });
    }

    _applyState(stateSource) {
        this.app.deselect();
        this.changes.forEach(change => {
            const state = change[stateSource];
            if (!state) return;
            
            const entity = change.entity;

            if (state.position) entity.position.copy(state.position);
            if (state.quaternion) entity.quaternion.copy(state.quaternion);
            if (state.scale) entity.scale.copy(state.scale);
            if (state.name) entity.name = state.name;

            if (state.material) {
                for (const key in state.material) {
                    if (key === 'color') {
                        entity.material.color.setHex(state.material.color);
                    } else if (entity.material[key] !== undefined) {
                        entity.material[key] = state.material[key];
                    }
                }
            }
            
            if (state.geometry) {
                entity.geometry.dispose(); // Dispose the old geometry
                const params = state.geometry;
                switch(entity.geometry.type) {
                    case 'BoxGeometry':
                        entity.geometry = new THREE.BoxGeometry(params.width, params.height, params.depth);
                        break;
                    case 'CylinderGeometry':
                         entity.geometry = new THREE.CylinderGeometry(params.radiusTop, params.radiusBottom, params.height, params.radialSegments || 16);
                        break;
                    case 'SphereGeometry':
                         entity.geometry = new THREE.SphereGeometry(params.radius, params.widthSegments || 16, params.heightSegments || 16);
                        break;
                }
            }
            
            this.app.addToSelection(entity);
        });
        this.app.ui.updateInspector();
    }

    execute() { this._applyState('afterState'); }
    undo() { this._applyState('beforeState'); }
}


export class UndoManager {
    constructor(app) {
        this.app = app;
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 100;

        this.updateUI();
    }

    execute(command) {
        this.undoStack.push(command);
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        this.redoStack = [];
        if(command.execute) command.execute();
        this.updateUI();
    }

    undo() {
        if (this.undoStack.length === 0) return;
        const command = this.undoStack.pop();
        this.redoStack.push(command);
        if(command.undo) command.undo();
        this.updateUI();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const command = this.redoStack.pop();
        this.undoStack.push(command);
        if(command.execute) command.execute();
        this.updateUI();
    }
    
    updateUI() {
        document.getElementById('menu-edit-undo').disabled = this.undoStack.length === 0;
        document.getElementById('menu-edit-redo').disabled = this.redoStack.length === 0;
    }
}