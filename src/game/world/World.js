import * as THREE from 'three';
import { EventEmitter } from '../../shared/EventEmitter.js';
import { LevelManager } from './LevelManager.js';
import { PlayerPrefab } from '../prefabs/PlayerPrefab.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { AISystem } from '../systems/AISystem.js';
import { AbilitySystem } from '../systems/AbilitySystem.js';
import { WeaponSystem } from '../systems/WeaponSystem.js';
import { TargetingSystem } from '../systems/TargetingSystem.js';
import { DeathSystem } from '../systems/DeathSystem.js';
import { TriggerSystem } from '../systems/TriggerSystem.js';
import { OutOfBoundsSystem } from '../systems/OutOfBoundsSystem.js';
import { StatusEffectSystem } from '../systems/StatusEffectSystem.js';
import { WaterSystem } from '../systems/WaterSystem.js';
import { PlayerResourceSystem } from '../systems/PlayerResourceSystem.js';
import { Fireball } from '../abilities/Fireball.js';
import { EnemyProjectile } from '../abilities/EnemyProjectile.js';
import { FireflyProjectile } from '../abilities/FireflyProjectile.js';

/**
 * Represents a single level instance, containing all entities, systems, and game state.
 */
export class World {
    constructor(core, game) {
        this.emitter = new EventEmitter(); // Composition
        this.core = core;
        this.game = game;
        this.scene = core.renderer.scene;
        this.physics = core.physics;
        
        this.levelName = '';
        this.spawnPoint = new THREE.Vector3();
        this.deathSpawnPoint = new THREE.Vector3();
        this.player = null;
        this.entities = new Set();
        this._entitiesByType = new Map();
        this.initialEnemyCount = 0;
        this.enemiesKilled = 0;
        this.lights = []; // To track lights for disposal

        this.levelManager = new LevelManager(this);
        this.systems = [
            new WaterSystem(),
            new MovementSystem(),
            new AISystem(),
            new AbilitySystem(),
            new PlayerResourceSystem(),
            new WeaponSystem(),
            new TargetingSystem(),
            new DeathSystem(),
            new OutOfBoundsSystem(),
            new StatusEffectSystem(),
        ];
        this.triggerSystem = new TriggerSystem(this);
    }

    // --- Event Emitter Delegation ---
    on(eventName, listener) { this.emitter.on(eventName, listener); }
    emit(eventName, data) { this.emitter.emit(eventName, data); }
    off(eventName, listener) { this.emitter.off(eventName, listener); }
    removeAllListeners() { this.emitter.removeAllListeners(); }

    async loadLevel(config) {
        let levelData;
        if (config.url) {
            const response = await fetch(config.url);
            if (!response.ok) throw new Error(`Failed to load level: ${response.statusText}`);
            levelData = await response.json();
        } else if (config.data) {
            levelData = config.data;
        } else {
            throw new Error('Level configuration must provide a URL or data.');
        }

        await this.levelManager.init();
        const { ambientLight, directionalLights } = await this.levelManager.build(levelData);

        // Add lights to scene and track them
        this.lights.push({ light: ambientLight });
        this.scene.add(ambientLight);
        directionalLights.forEach(dLight => {
            this.lights.push({ light: dLight, target: dLight.target });
            this.scene.add(dLight);
            this.scene.add(dLight.target);
        });

        this.player = PlayerPrefab.create(
            this,
            this.core.renderer.camera,
            this.game.viewModelScene,
            config.loadout
        );
        this.add(this.player);
    }
    
    onNPCDied(npc) {
        if (npc.team === 'enemy') {
            this.enemiesKilled++;
            if (this.initialEnemyCount > 0 && this.enemiesKilled >= this.initialEnemyCount) {
                this.emit('levelCompleted');
            }
        }
    }

    add(entity) {
        if (!entity || this.entities.has(entity)) return;
        this.entities.add(entity);
        if (entity.type) {
            if (!this._entitiesByType.has(entity.type)) {
                this._entitiesByType.set(entity.type, new Set());
            }
            this._entitiesByType.get(entity.type).add(entity);
        }
        
        if (entity.mesh) this.scene.add(entity.mesh);
        if (entity.helperMesh) this.scene.add(entity.helperMesh);
        const body = entity.physics?.body || entity.body;
        if (body) this.physics.addBody(body);

        this.emit('entityAdded', { entity });

        if (entity.type === 'npc') this.emit('npcSpawned', { npc: entity });
    }

    remove(entity) {
        if (!entity || !this.entities.has(entity)) return;
        this.emit('entityRemoved', { entity });
        if (entity.dispose) entity.dispose();
        else {
            if (entity.mesh) {
                this.scene.remove(entity.mesh);
                entity.mesh.geometry?.dispose();
                if (Array.isArray(entity.mesh.material)) entity.mesh.material.forEach(m => m.dispose());
                else entity.mesh.material?.dispose();
            }
             if (entity.helperMesh) this.scene.remove(entity.helperMesh);
            const body = entity.physics?.body || entity.body;
            if (body) this.physics.queueForRemoval(body);
        }
        
        this.entities.delete(entity);
        if (entity.type && this._entitiesByType.has(entity.type)) {
            this._entitiesByType.get(entity.type).delete(entity);
        }
    }

    getEntities() { return Array.from(this.entities); }
    getNPCs() { return Array.from(this._entitiesByType.get('npc') || []); }
    getEnemies() { return this.getNPCs().filter(npc => npc.team === 'enemy'); }
    getAllies() { return this.getNPCs().filter(npc => npc.team === 'player'); }
    getLevelObjects() { return Array.from(this._entitiesByType.get('Object') || []); }
    getTriggers() { return Array.from(this._entitiesByType.get('Trigger') || []); }
    getDeathTriggers() { return Array.from(this._entitiesByType.get('DeathTrigger') || []); }
    getWaterVolumes() { return Array.from(this._entitiesByType.get('Water') || []); }
    getWaterfalls() { return Array.from(this._entitiesByType.get('Waterfall') || []); }

    resetPlayer() {
        if (this.player) {
            this.player.reset(this.deathSpawnPoint);
            this.emit('playerRespawned');
        }
    }

    createFireball(data) { new Fireball({ world: this, ...data }); }
    createEnemyProjectile(data) { new EnemyProjectile({ world: this, ...data }); }
    createFireflyProjectile(data) { new FireflyProjectile({ world: this, ...data }); }

    update(deltaTime) {
        const elapsedTime = this.core.clock.getElapsedTime();
        for (const system of this.systems) system.update(this, deltaTime);
        for (const entity of this.entities) if (entity.update) entity.update(deltaTime);

        const entitiesWithShaders = [...this.getWaterVolumes(), ...this.getWaterfalls()];
        for (const entity of entitiesWithShaders) {
            const uniforms = entity.mesh?.material?.uniforms;
            if (uniforms) {
                if (uniforms.time) { // For THREE.Water pools
                    uniforms.time.value = elapsedTime;
                }
                if (uniforms.uTime) { // For custom waterfall shader
                    uniforms.uTime.value = elapsedTime;
                }
            }
        }
    }
    
    dispose() {
        this.removeAllListeners();
        this.triggerSystem.dispose();
        
        // Dispose lights first
        this.lights.forEach(item => {
            this.scene.remove(item.light);
            if (item.target) this.scene.remove(item.target);
            item.light.dispose();
        });
        this.lights = [];

        [...this.entities].forEach(entity => this.remove(entity));
        this.scene.children.slice().forEach(child => {
            if (child.type !== 'PerspectiveCamera') this.scene.remove(child);
        });
        this.physics.world.bodies.forEach(body => this.physics.queueForRemoval(body));
        this.physics._removeQueuedBodies();
        this.systems = [];
    }
}