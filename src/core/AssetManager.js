import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class AssetManager {
    constructor() {
        this.textureLoader = new THREE.TextureLoader();
        this.gltfLoader = new GLTFLoader();
        
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        this.gltfLoader.setDRACOLoader(dracoLoader);
        
        this.cache = new Map();
        this.loadingPromises = [];
    }

    _loadTexture(name, path) {
        const promise = new Promise((resolve, reject) => {
            if (this.cache.has(name)) {
                resolve(this.cache.get(name));
                return;
            }
            this.textureLoader.load(
                path,
                (texture) => {
                    this.cache.set(name, texture);
                    resolve(texture);
                },
                undefined, // onProgress
                (error) => {
                    console.error(`Failed to load texture: ${name} from ${path}`, error);
                    reject(error);
                }
            );
        });
        this.loadingPromises.push(promise);
    }
    
    _loadGLTF(name, path) {
        const promise = new Promise((resolve, reject) => {
            if (this.cache.has(name)) {
                resolve(this.cache.get(name));
                return;
            }
            this.gltfLoader.load(
                path,
                (gltf) => {
                    this.cache.set(name, gltf);
                    resolve(gltf);
                },
                undefined, // onProgress
                (error) => {
                    console.error(`Failed to load GLTF model: ${name} from ${path}`, error);
                    reject(error);
                }
            );
        });
        this.loadingPromises.push(promise);
    }
    
    _loadAudio(name, path) {
        const promise = new Promise((resolve, reject) => {
             if (this.cache.has(name)) {
                resolve(this.cache.get(name));
                return;
            }
            const audio = new Audio(path);
            audio.addEventListener('canplaythrough', () => {
                this.cache.set(name, audio);
                resolve(audio);
            }, { once: true });
            audio.addEventListener('error', (e) => {
                console.error(`Failed to load audio: ${name} from ${path}`, e);
                reject(e);
            });
        });
        this.loadingPromises.push(promise);
    }

    queue(assets) {
        for (const asset of assets) {
            switch(asset.type) {
                case 'texture':
                    this._loadTexture(asset.name, asset.path);
                    break;
                case 'gltf':
                    this._loadGLTF(asset.name, asset.path);
                    break;
                case 'audio':
                    this._loadAudio(asset.name, asset.path);
                    break;
                default:
                    console.warn(`Unknown asset type: ${asset.type}`);
            }
        }
    }

    async loadAll() {
        try {
            await Promise.all(this.loadingPromises);
        } catch (error) {
            console.error("An error occurred during asset loading.", error);
        } finally {
            this.loadingPromises = [];
        }
    }

    get(name) {
        if (!this.cache.has(name)) {
            throw new Error(`Asset not found in cache: ${name}`);
        }
        return this.cache.get(name);
    }
}