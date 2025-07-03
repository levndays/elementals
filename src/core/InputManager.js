import { EventEmitter } from '../shared/EventEmitter.js';

export class InputManager extends EventEmitter {
    constructor() {
        super();
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

        this.mousePreviousState = {};

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onWheel = this._onWheel.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);
        
        this.addEventListeners();
    }

    addEventListeners() {
        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('keyup', this._onKeyUp);
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mousedown', this._onMouseDown);
        document.addEventListener('mouseup', this._onMouseUp);
        document.addEventListener('wheel', this._onWheel, { passive: false });
        document.addEventListener('contextmenu', this._onContextMenu);
    }

    _onKeyDown(e) {
        // Emit a singlePress event only on the initial press
        if (!this.keys[e.code]) {
            this.emit('singlePress', { code: e.code });
        }
        this.keys[e.code] = true;
    }
    _onKeyUp(e) { this.keys[e.code] = false; }
    
    _onMouseDown(e) {
        if (e.button === 0) this.mouse.leftClick = true;
        if (e.button === 2) this.mouse.rightClick = true;
        
        if (!this.mousePreviousState[e.button]) {
            this.emit('singlePress', { button: e.button });
        }
        this.mousePreviousState[e.button] = true;
    }

    _onMouseUp(e) {
        if (e.button === 0) this.mouse.leftClick = false;
        if (e.button === 2) this.mouse.rightClick = false;
        this.mousePreviousState[e.button] = false;
    }

    _onMouseMove(e) {
        this.mouse.screenX = e.clientX;
        this.mouse.screenY = e.clientY;
        this.mouse.movementX = e.movementX;
        this.mouse.movementY = e.movementY;
    }

    _onWheel(e) {
        if (this.enabled) {
            e.preventDefault(); // Prevent page scrolling during gameplay
            this.emit('scroll', { deltaY: e.deltaY });
        }
    }

    _onContextMenu(e) {
        e.preventDefault();
    }

    update() {
        this.mouse.movementX = 0;
        this.mouse.movementY = 0;
    }
    
    dispose() {
        document.removeEventListener('keydown', this._onKeyDown);
        document.removeEventListener('keyup', this._onKeyUp);
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mousedown', this._onMouseDown);
        document.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('wheel', this._onWheel);
        document.removeEventListener('contextmenu', this._onContextMenu);
    }
}