/**
 * A command representing a state change on an entity. It holds the "before"
 * and "after" states, allowing the change to be executed and undone.
 */
export class StateChangeCommand {
    constructor(editor, entity, beforeState, afterState) {
        this.editor = editor;
        this.entity = entity;
        this.beforeState = JSON.parse(JSON.stringify(beforeState));
        this.afterState = JSON.parse(JSON.stringify(afterState));
    }

    execute() {
        this.entity.definition = JSON.parse(JSON.stringify(this.afterState));
        this.editor.applyDefinition(this.entity);
        this.editor.select(this.entity);
    }

    undo() {
        this.entity.definition = JSON.parse(JSON.stringify(this.beforeState));
        this.editor.applyDefinition(this.entity);
        this.editor.select(this.entity);
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
        this.redoStack = [];
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