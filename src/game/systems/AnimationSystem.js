import * as THREE from 'three';

/**
 * Plays keyframe animations defined in custom asset data.
 */
export class AnimationSystem {
    constructor() {
        this.activeAnimations = new Map(); // Map<entity, { clipName, time, duration }>
    }

    update(world, deltaTime) {
        // Listen for new animation requests
        world.on('animationTriggered', ({ entity, clipName }) => {
            if (entity.assetData?.animations[clipName]) {
                const clip = entity.assetData.animations[clipName];
                this.activeAnimations.set(entity, {
                    clipName,
                    time: 0,
                    duration: clip.duration,
                });
            }
        });

        if (this.activeAnimations.size === 0) return;

        // Update active animations
        for (const [entity, animState] of this.activeAnimations.entries()) {
            animState.time += deltaTime;

            if (animState.time >= animState.duration) {
                this.resetToIdle(entity);
                this.activeAnimations.delete(entity);
                continue;
            }

            this.applyKeyframes(entity, animState);
        }
    }

    applyKeyframes(entity, animState) {
        const clip = entity.assetData.animations[animState.clipName];
        if (!clip) return;

        for (const track of clip.tracks) {
            const targetPart = entity.parts.get(track.targetUUID);
            if (!targetPart) continue;

            const { prevKey, nextKey } = this.findSurroundingKeys(track.keyframes, animState.time);
            
            if (!prevKey) continue;

            const t = (nextKey)
                ? (animState.time - prevKey.time) / (nextKey.time - prevKey.time)
                : 1;

            const value = (nextKey) 
                ? THREE.MathUtils.lerp(prevKey.value, nextKey.value, t)
                : prevKey.value;
            
            // This is a simplified version; a full implementation would handle vectors and quaternions.
            // e.g., if track.property is "position.z"
            const props = track.property.split('.');
            if (props.length === 2 && targetPart[props[0]]) {
                targetPart[props[0]][props[1]] = value;
            }
        }
    }

    findSurroundingKeys(keyframes, time) {
        let prevKey = null, nextKey = null;
        for (const key of keyframes) {
            if (key.time <= time) {
                prevKey = key;
            } else {
                nextKey = key;
                break;
            }
        }
        return { prevKey, nextKey };
    }

    resetToIdle(entity) {
        for (const partData of entity.assetData.geometry) {
            const partMesh = entity.parts.get(partData.uuid);
            if (!partMesh) continue;
            const { position, rotation } = partData.transform;
            if (position) partMesh.position.fromArray(position);
            if (rotation) partMesh.quaternion.setFromEuler(new THREE.Euler().fromArray(rotation));
        }
    }
}