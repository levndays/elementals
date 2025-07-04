/**
 * A command representing a state change on an entity. It holds the "before"
 * and "after" states, allowing the change to be executed and undone.
 */

export class StateChangeCommand {
    /**
     * Can be constructed in two ways:
     * 1. new StateChangeCommand(editor, changes) where changes is an array of {entity, beforeState, afterState}
     * 2. new StateChangeCommand(editor, entity, beforeState, afterState) for a single object change
     * @param {import('./LevelEditor.js').LevelEditor} editor
     * @param {Array|object} changesOrEntity
     * @param {object} [beforeState]
     * @param {object} [afterState]
     */
    constructor(editor, changesOrEntity, beforeState, afterState) {
        this.editor = editor;
        
        if (Array.isArray(changesOrEntity)) {
            // New signature for multi-object changes
            this.changes = changesOrEntity.map(c => ({
                entity: c.entity,
                beforeState: JSON.parse(JSON.stringify(c.beforeState)),
                afterState: JSON.parse(JSON.stringify(c.afterState)),
            }));
        } else {
            // Original signature for single-object changes
            this.changes = [{
                entity: changesOrEntity,
                beforeState: JSON.parse(JSON.stringify(beforeState)),
                afterState: JSON.parse(JSON.stringify(afterState)),
            }];
        }
    }

    execute() {
        this.changes.forEach(change => {
            change.entity.definition = JSON.parse(JSON.stringify(change.afterState));
            const mesh = change.entity.mesh || change.entity.picker || change.entity;
            if (mesh && change.afterState.size) {
                 mesh.scale.set(1, 1, 1);
            }
            this.editor.applyDefinition(change.entity);
        });
        
        this.editor.deselect();
        this.changes.forEach(change => this.editor.addToSelection(change.entity));
        this.editor.ui.updatePropertiesPanel();
    }

    undo() {
        this.changes.forEach(change => {
            change.entity.definition = JSON.parse(JSON.stringify(change.beforeState));
            const mesh = change.entity.mesh || change.entity.picker || change.entity;
            if (mesh && change.beforeState.size) {
                mesh.scale.set(1, 1, 1);
            }
            this.editor.applyDefinition(change.entity);
        });
        
        this.editor.deselect();
        this.changes.forEach(change => this.editor.addToSelection(change.entity));
        this.editor.ui.updatePropertiesPanel();
    }
}

/**
 * Manages the undo and redo stacks for editor commands.
 */
export class UndoManager {
    constructor(editor) {
        this.editor = editor;
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 50;
    }

    execute(command) {
        this.undoStack.push(command);
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        this.redoStack = []; // Clear redo stack on new command
        command.execute();
    }

    undo() {
        if (this.undoStack.length === 0) return;
        const command = this.undoStack.pop();
        this.redoStack.push(command);
        command.undo();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const command = this.redoStack.pop();
        this.undoStack.push(command);
        command.execute();
    }
}