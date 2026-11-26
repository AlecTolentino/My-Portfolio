
import * as THREE from 'three';

export function createFreeCamera({camera, canvas, onDisable}) {

    // SETTINGS
    const SPEED = 20;
    const SENSITIVITY = 0.002;

    // STATE
    let enabled = false;
    let pointerLocked = false;

    let yaw = 0;
    let pitch = 0;

    const keys = {
        w: false,
        a: false,
        s: false,
        d: false,
        q: false,
        e: false
    };

    const worldUp = new THREE.Vector3(0, 1, 0);
    const direction = new THREE.Vector3();
    const right = new THREE.Vector3();
    const movement = new THREE.Vector3();

    // Reset movement keys
    function resetKeys() {
        Object.keys(keys).forEach(key => {
            keys[key] = false;
        });
    }

    // ENABLE / DISABLE
    function enable() {

        if(enabled) return;

        enabled = true;

        // Capture the camera's current viewing direction
        camera.getWorldDirection(direction);

        // Three.js cameras look down their local negative Z axis.
        // These calculations preserve the current view without a 90-degree rotation.
        yaw = Math.atan2(-direction.x, -direction.z);
        pitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));

        camera.rotation.order = "YXZ";
        camera.rotation.set(pitch, yaw, 0, "YXZ");

        resetKeys();
    }

    function disable() {

        if(!enabled) return;

        enabled = false;

        resetKeys();

        if(document.pointerLockElement === canvas) {
            document.exitPointerLock();
        }

        pointerLocked = false;

        if(onDisable) onDisable();

        console.log("Free camera disabled.");
    }

    function toggle() {

        if(enabled) {
            disable();
        }
        else {
            enable();
        }
    }

    // KEYBOARD INPUT
    window.addEventListener("keydown", (e) => {

        const key = e.key.toLowerCase();

        // F toggles free camera
        if(key === "f" && !e.repeat) {
            toggle();
            return;
        }

        if(!enabled) return;

        if(key in keys) {
            keys[key] = true;
        }
    });

    window.addEventListener("keyup", (e) => {

        const key = e.key.toLowerCase();

        if(key in keys) {
            keys[key] = false;
        }
    });

    // Prevent stuck keys if the browser loses focus
    window.addEventListener("blur", resetKeys);

    // MOUSE POINTER LOCK
    canvas.addEventListener("click", () => {

        if(enabled && !pointerLocked) {
            canvas.requestPointerLock();
        }
    });

    document.addEventListener("pointerlockchange", () => {

        pointerLocked = document.pointerLockElement === canvas;
    });

    // MOUSE LOOK
    document.addEventListener("mousemove", (e) => {

        if(!enabled || !pointerLocked) return;

        yaw -= e.movementX * SENSITIVITY;
        pitch -= e.movementY * SENSITIVITY;

        pitch = THREE.MathUtils.clamp(
            pitch,
            -Math.PI / 2 + 0.01,
            Math.PI / 2 - 0.01
        );

        camera.rotation.order = "YXZ";
        camera.rotation.set(pitch, yaw, 0, "YXZ");
    });

    // MOVEMENT
    function update(dt) {

        if(!enabled) return;

        camera.getWorldDirection(direction);

        // Horizontal right direction, independent of camera pitch
        right.crossVectors(direction, worldUp).normalize();

        movement.set(0, 0, 0);

        if(keys.w) movement.add(direction);
        if(keys.s) movement.sub(direction);

        if(keys.d) movement.add(right);
        if(keys.a) movement.sub(right);

        if(keys.q) movement.y += 1;
        if(keys.e) movement.y -= 1;

        if(movement.lengthSq() > 0) {

            movement.normalize();

            camera.position.addScaledVector(
                movement,
                SPEED * dt
            );
        }
    }

    return {
        enable,
        disable,
        toggle,
        update,

        get enabled() {
            return enabled;
        }
    };
}
