import * as THREE from 'three';

/**
 * Manages data-driven animation playback for the asset editor.
 * It reads animation clips from the AssetContext and applies keyframed transformations.
 */
export class AnimationManager {
    constructor(app) {
        this.app = app;
        this.isPlaying = false;
        this.playbackTime = 0;
        this.activeClip = null;
        this.activeClipName = null;
        this.activeClipDuration = 0;

        /** @type {Map<string, {position: THREE.Vector3, quaternion: THREE.Quaternion, scale: THREE.Vector3}>} */
        this.initialTransforms = new Map();

        this.app.ui.animationClipSelect.onchange = (e) => {
            this.app.ui.updateTimelineView();
            this.triggerClip(e.target.value);
        }
        this.app.ui.animPlayBtn.onclick = () => {
            if (this.isPlaying) this.stop();
            else this.triggerClip(this.app.ui.animationClipSelect.value);
        };
        this.app.ui.animStopBtn.onclick = () => this.stop();
    }
    
    stop() {
        this.resetToIdle();
        this.app.ui.animPlayBtn.textContent = '▶';
    }

    triggerClip(clipName) {
        if (!clipName) return;
        const clip = this.app.assetContext.animations[clipName];
        if (!clip) {
            console.warn(`Animation clip "${clipName}" not found.`);
            return;
        }

        if (this.isPlaying) {
            this.resetToIdle();
        }
        
        this.isPlaying = true;
        this.activeClip = clip;
        this.activeClipName = clipName;
        this.activeClipDuration = clip.duration;
        this.playbackTime = 0;

        this.app.ui.animPlayBtn.textContent = '❚❚';
        
        this.storeInitialTransforms();
    }

    storeInitialTransforms() {
        this.initialTransforms.clear();
        const root = this.app.assetContext.assetRoot;
        root.traverse(child => {
            if (child === root || this.app.assetContext.parts.has(child.uuid)) {
                const id = child === root ? 'AssetRoot' : child.uuid;
                this.initialTransforms.set(id, {
                    position: child.position.clone(),
                    quaternion: child.quaternion.clone(),
                    scale: child.scale.clone(),
                });
            }
        });
    }
    
    _findSurroundingKeys(keyframes, time) {
        let prevKey = keyframes[0];
        let nextKey = keyframes[keyframes.length - 1];

        for (let i = 0; i < keyframes.length; i++) {
            if (keyframes[i].time <= time) {
                prevKey = keyframes[i];
            }
            if (keyframes[i].time > time) {
                nextKey = keyframes[i];
                break;
            }
        }
        return { prevKey, nextKey };
    }

    seek(time) {
        if (!this.activeClip) {
            this.triggerClip(this.app.ui.animationClipSelect.value);
            if (!this.activeClip) return;
        }

        this.playbackTime = Math.max(0, Math.min(time, this.activeClipDuration));
        this._applyKeyframes();
        this.app.ui.animTimeDisplay.textContent = `${this.playbackTime.toFixed(2)}s`;
    }

    _applyKeyframes() {
        if (!this.activeClip) return;

        for (const track of this.activeClip.tracks) {
            const target = track.targetUUID === 'AssetRoot' 
                ? this.app.assetContext.assetRoot 
                : this.app.assetContext.parts.get(track.targetUUID);

            if (!target) continue;

            const { prevKey, nextKey } = this._findSurroundingKeys(track.keyframes, this.playbackTime);
            
            const timeRange = nextKey.time - prevKey.time;
            const t = (timeRange > 0.0001) ? (this.playbackTime - prevKey.time) / timeRange : 1.0;
            const easedT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // Ease in/out quadratic

            switch (track.property) {
                case 'position': {
                    const start = new THREE.Vector3().fromArray(prevKey.value);
                    const end = new THREE.Vector3().fromArray(nextKey.value);
                    target.position.lerpVectors(start, end, easedT);
                    break;
                }
                case 'rotation': {
                    const startQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler().fromArray(prevKey.value.map(THREE.MathUtils.degToRad)));
                    const endQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler().fromArray(nextKey.value.map(THREE.MathUtils.degToRad)));
                    target.quaternion.slerpQuaternions(startQuat, endQuat, easedT);
                    break;
                }
                case 'scale': {
                    const start = new THREE.Vector3().fromArray(prevKey.value);
                    const end = new THREE.Vector3().fromArray(nextKey.value);
                    target.scale.lerpVectors(start, end, easedT);
                    break;
                }
            }
        }
    }

    update(deltaTime) {
        if (!this.isPlaying) return;

        this.playbackTime += deltaTime;
        this.app.ui.animTimeDisplay.textContent = `${this.playbackTime.toFixed(2)}s`;

        if (this.playbackTime >= this.activeClipDuration) {
            this.resetToIdle();
            this.app.ui.animPlayBtn.textContent = '▶';
            return;
        }

        this._applyKeyframes();
    }

    resetToIdle() {
        this.isPlaying = false;
        this.activeClip = null;
        this.playbackTime = 0;
        this.app.ui.animTimeDisplay.textContent = '0.00s';
        
        this.initialTransforms.forEach((transform, uuid) => {
            const target = uuid === 'AssetRoot' 
                ? this.app.assetContext.assetRoot 
                : this.app.assetContext.parts.get(uuid);
            
            if (target) {
                target.position.copy(transform.position);
                target.quaternion.copy(transform.quaternion);
                target.scale.copy(transform.scale);
            }
        });
    }
}