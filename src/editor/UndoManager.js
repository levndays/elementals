export class StateChangeCommand {
    constructor(editor, entity, beforeState, afterState) {
        this.editor = editor;
        this.entity = entity;
        this.beforeState = JSON.parse(JSON.stringify(beforeState)); // Deep copy
        this.afterState = JSON.parse(JSON.stringify(afterState)); // Deep copy
    }

    execute() {
        this.entity.definition = JSON.parse(JSON.stringify(this.afterState));
        this.editor.applyDefinition(this.entity);
        this.editor.select(this.entity); // Reselect to update UI
    }

    undo() {
        this.entity.definition = JSON.parse(JSON.stringify(this.beforeState));
        this.editor.applyDefinition(this.entity);
        this.editor.select(this.entity); // Reselect to update UI
    }
}


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
            this.undoStack.shift(); // Keep history size manageable
        }
        this.redoStack = []; // Clear redo stack on new action
        command.execute();
        console.log("Action executed. Undo stack size:", this.undoStack.length);
    }

    undo() {
        if (this.undoStack.length === 0) return;
        const command = this.undoStack.pop();
        this.redoStack.push(command);
        command.undo();
        console.log("Action undone. Undo stack size:", this.undoStack.length);
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const command = this.redoStack.pop();
        this.undoStack.push(command);
        command.execute();
        console.log("Action redone. Undo stack size:", this.undoStack.length);
    }
}