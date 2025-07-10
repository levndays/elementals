import * as THREE from 'three';

/**
 * A visual guide in the editor to help with weapon scale, orientation, and root position.
 */
export class ViewModelGuide extends THREE.Group {
    constructor() {
        super();
        this.name = 'ViewModelGuide';
        this.createHelpers();
    }

    createHelpers() {
        // 1. Bounding box for typical weapon size
        const boxSize = { width: 0.4, height: 0.5, depth: 1.2 };
        const boxGeom = new THREE.BoxGeometry(boxSize.width, boxSize.height, boxSize.depth);
        const boxEdges = new THREE.EdgesGeometry(boxGeom);
        const boxMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.4 });
        const boxHelper = new THREE.LineSegments(boxEdges, boxMat);
        // Position the box so its back is at the origin (where the grip should be)
        boxHelper.position.z = boxSize.depth / 2;
        this.add(boxHelper);

        // 2. Arrow indicating the "forward" direction (+Z) for modeling
        const arrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1), // direction
            new THREE.Vector3(0, 0, 0), // origin
            1.5, // length
            0xffff00, // color
            0.2, // headLength
            0.1 // headWidth
        );
        this.add(arrow);

        // 3. Sphere indicating the hand/grip position at the origin
        const handGeom = new THREE.SphereGeometry(0.08);
        const handMat = new THREE.MeshBasicMaterial({ color: 0x00a3ff, wireframe: true });
        const handSphere = new THREE.Mesh(handGeom, handMat);
        this.add(handSphere);
    }

    /**
     * Sets the visibility of the entire guide.
     * @param {boolean} visible 
     */
    setVisible(visible) {
        this.visible = visible;
    }
}