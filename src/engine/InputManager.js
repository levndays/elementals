export class InputManager {
    constructor() {
        this.keys = {};
        this.mouse = {
            movementX: 0,
            movementY: 0,
            leftClick: false,
            rightClick: false,
            screenX: 0,
            screenY: 0,
        };
        this.enabled = true;

        document.addEventListener('keydown', (e) => this.keys[e.code] = true);
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);

        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    }

    handleMouseMove(event) {
        this.mouse.screenX = event.clientX;
        this.mouse.screenY = event.clientY;
        // Always update movement properties. The consumer (game/editor) will decide how to use them.
        // The game uses them when pointer is locked. The editor will use them when a mouse button is held.
        this.mouse.movementX = event.movementX;
        this.mouse.movementY = event.movementY;
    }

    handleMouseDown(event) {
        if (event.button === 0) this.mouse.leftClick = true;
        if (event.button === 2) this.mouse.rightClick = true;
    }
    
    handleMouseUp(event) {
        if (event.button === 0) this.mouse.leftClick = false;
        if (event.button === 2) this.mouse.rightClick = false;
    }
    
    isClickOnUI(x, y) {
        const editorUI = document.getElementById('editor-ui');
        if (!editorUI) return false;

        const rect = editorUI.getBoundingClientRect();
        return (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
        );
    }

    update() {
        this.mouse.movementX = 0;
        this.mouse.movementY = 0;
    }
}