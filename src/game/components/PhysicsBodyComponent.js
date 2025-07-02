/**
 * Data component holding a reference to an entity's CANNON-ES physics body.
 */
export class PhysicsBodyComponent {
    /**
     * @param {import('cannon-es').Body} body
     */
    constructor(body) {
        this.body = body;
    }
}