
import * as THREE from 'three';
import gsap from 'gsap';

export function createStreetCamera({camera,locations,entranceLocations,
    onNavigate = () => {},
    onEntranceStart = () => {},
    onEntrance = () => {}
}){

    // Camera settings
    const PITCH = THREE.MathUtils.degToRad(12);
    const YAW = THREE.MathUtils.degToRad(0.85);

    let curCamPos = 315;
    let targetCamPos = 315;

    // Movement settings
    const SMOOTH = 3.6;
    const SCROLL_SPEED = 0.3;
    const KEY_MOVE = 40;

    const roadStart = 90;
    const roadEnd = 2255;

    const forward = new THREE.Vector3(
        -Math.cos(PITCH) * Math.cos(YAW),
        -Math.sin(PITCH),
        -Math.cos(PITCH) * Math.sin(YAW)
    );

    // Navigation state
    let isNavigating = false;
    let isEntranceMove = false;
    let isAtEntrance = false;

    let navDest = 0;
    const navTrip = {pos: 0};

    const ENTRANCE_FADE_DELAY = 0.4;

    // Camera movement easing
    const camEase = (t) => {

        const c = 0.35;
        if(t < c) return 0.5 * (t / c) ** 2;

        const s = (t - c) / (1 - c);
        return 0.5 + 0.5 * (1 - (1 - s) ** 2.1);
    };

    // Update normal street camera position
    function update(dt){

        if(isEntranceMove || isAtEntrance) return;
        curCamPos += (targetCamPos - curCamPos) * (1 - Math.exp(-SMOOTH * dt));

        camera.position.set(210, 72, -curCamPos);
        const lookTarget = camera.position.clone().addScaledVector(forward, 100);

        camera.lookAt(lookTarget);
    };

    // Scroll along the street
    function scroll(deltaY){

        gsap.killTweensOf(navTrip);
        targetCamPos += deltaY * SCROLL_SPEED;

        targetCamPos = THREE.MathUtils.clamp(targetCamPos, roadStart, roadEnd);
    };

    // Drag along the street
    function drag(delta){

        targetCamPos += delta;
        targetCamPos = THREE.MathUtils.clamp(targetCamPos, roadStart, roadEnd);
    };

    // Move using arrow keys
    function moveBy(direction){

        gsap.killTweensOf(navTrip);
        targetCamPos += direction * KEY_MOVE;

        targetCamPos = THREE.MathUtils.clamp(targetCamPos, roadStart, roadEnd);
    };

    // Synchronise after free camera is disabled
    function syncPosition(){

        curCamPos = -camera.position.z;
        targetCamPos = curCamPos;

        camera.rotation.order = "XYZ";
    };

    // Navigate to a location
    function navigateTo(location){

        // Navigation started
        onNavigate();

        if(!(location in locations)){
            console.warn("No location for:", location);
            return;
        }

        document.body.style.cursor = "default";

        isNavigating = true;
        isEntranceMove = false;
        isAtEntrance = false;

        // Reset camera 
        camera.position.set(210, 72, -curCamPos);
        const lookTarget = camera.position.clone().addScaledVector(forward, 100);

        camera.lookAt(lookTarget);

        // Set destination position
        navDest = locations[location];
        navTrip.pos = curCamPos;

        // Stop existing camera animations
        gsap.killTweensOf(navTrip);
        gsap.killTweensOf(camera.position);

        // Calculate travel duration based on location distance
        const duration = THREE.MathUtils.clamp(Math.abs(navDest - curCamPos) / 600,0.9,1.6);

        // Part 1: Travel along the street --------------------------------------------------------------------------------------
        gsap.to(navTrip, {pos: navDest, duration, ease: camEase,

            // Keep the camera's current and target positions synchronised
            onUpdate: () => {

                curCamPos = navTrip.pos;
                targetCamPos = navTrip.pos;
            },

            // Ensure the camera finishes exactly at the destination
            onComplete: () => {

                curCamPos = navDest;
                targetCamPos = navDest;

                // Check if entrance
                const entrance = entranceLocations[location];

                if(!entrance){
                    isNavigating = false;
                    return;
                }

                // Part 2: Move towards building entrance ------------------------------------------------------------------------
                isEntranceMove = true;

                const entranceTimeline = gsap.timeline({

                     // Mark navigation as complete once the entrance is reached
                    onComplete: () => {

                        isEntranceMove = false;
                        isAtEntrance = true;
                        isNavigating = false;

                        onEntrance(location);
                    }
                });

                entranceTimeline.to(camera.position, {

                    x: entrance.x,
                    y: entrance.y,
                    z: entrance.z,

                    duration: 1,
                    ease: "power2.inOut",

                    // Keep the camera looking in the same direction during the approach
                    onUpdate: () => {
                        
                        camera.lookAt(
                            entrance.x + forward.x * 100,
                            entrance.y + forward.y * 100,
                            entrance.z + forward.z * 100
                        );
                    }
                });

                // Fade 0.6 seconds into cam movement
                entranceTimeline.call(() => onEntranceStart(location), [], ENTRANCE_FADE_DELAY);
            }
        });
    }

    // Return public controls
    return {
        update,
        scroll,
        drag,
        moveBy,
        navigateTo,
        syncPosition,

        get isNavigating(){
            return isNavigating;
        },

        get isAtEntrance(){
            return isAtEntrance;
        },

        setAtEntrance(value){
            isAtEntrance = value;
        }
    };
}
