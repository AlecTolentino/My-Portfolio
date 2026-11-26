import * as THREE from 'three';
import gsap from 'gsap';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Custom imps
import {interiors} from './world/interiors.js';
import {createModelManager } from './systems/modelManager.js'
import {createTransitions} from './systems/transitions.js';
import {createHover} from './interactions/hover.js';
import {playSound, setHoverSound} from './systems/sound.js';
import {createFreeCamera} from './cameras/freeCam.js';

import './style.scss'

const canvas = document.querySelector("#experience-canvas")
canvas.style.touchAction = "none";

// Stop text selection, the long-press menu and the magnifier loupe on touch screens
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("selectstart", (e) => e.preventDefault());

// MAIN VARS ------------------------------------------------------------------------------------------------------------
const sizes = {

    width: window.innerWidth,
    height: window.innerHeight
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let street = null;

const rayCastObjects = [];

// Camera settings
const FOV = 68
const PITCH = THREE.MathUtils.degToRad(12);
const YAW = THREE.MathUtils.degToRad(0.85);
let curCamPos = 315
let targetCamPos = 315

// Cam speed vars etc
const SMOOTH = 3.6;
const DRAG_SPEED = 0.25;
const MOBILE_DRAG_SPEED = 0.6;
const SCROLL_SPEED = 0.3
const KEY_MOVE = 40;
let lastFrameTime = performance.now();

// Road vars
const roadStart = 90
const roadEnd = 2255
const roadLen = roadEnd - roadStart

// Movement vars
let isDragging = false;
let dragged = false;
let isNavMove = false
let isEntranceMove = false;
let isAtEntrance = false;

// Phone control
const HOVER_HOLD = 600;
let hoverHoldUntil = 0;

// Hover animation plays and then speeds up
let navDest = 0;
const navTrip = {pos: 0};
const NAV_RELEASE = 10;

// Pointer positions
let startX = 0
let lastXPos = 0;

// Locations
const locations = {
    start: 314,
    projects: 592,
    experience: 854,
    skills: 1120,
    about: 1390,
    tools_platforms: 1575,
    contact: 1605,
    more_coming: 1927
};

const loc_entrance_coords = {
    x: 61.02,
    y: 40,
    zOffset: -2.34
};

const entranceLocations = {

    // Standard buildings
    projects: getEntrancePos('projects'),
    experience: getEntrancePos('experience'),
    skills: getEntrancePos('skills'),

    // Special cases
    about: {
        x: -20.69,
        y: 33.53,
        z: -1371.03
    },

    tools_platforms: {
        x: 2.72,
        y: 29,
        z: -1573.91
    },

    contact: {
        x: 16.57,
        y: 37,
        z: -1611.75
    }
};

const socials = {
    "Github": "https://github.com/AlecTolentino",
    "Linkedin": "https://www.linkedin.com/in/alec-tolentino-bd2004",
};

// Three JS setup
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xbfd8f0);

const camera = new THREE.PerspectiveCamera(FOV, 1, 3, 850);
const forward = new THREE.Vector3(
    -Math.cos(PITCH) * Math.cos(YAW),
    -Math.sin(PITCH),
    -Math.cos(PITCH) * Math.sin(YAW)
);

// Raycasting
const locationKeys = Object.keys(locations).sort((a,b) => b.length - a.length);

// Hover
const hover = createHover({scene, camera});

// Free camera helper
const DEV_MODE = true;
const freeCamera = DEV_MODE ?  createFreeCamera({camera, canvas,

    onDisable: () => {

        // Return normal camera navigation to the current Z position
        curCamPos = -camera.position.z;
        targetCamPos = curCamPos;

        camera.rotation.order = "XYZ";
    }
}) : null;

// EVENT LISTENERS ------------------------------------------------------------------------------------------------------

// Wheel scrolling
window.addEventListener("wheel", (e) => {

    e.preventDefault();
    if(isNavMove || freeCamera?.enabled) return;

    gsap.killTweensOf(navTrip);
    targetCamPos += e.deltaY * SCROLL_SPEED;

    // Prevent leaving street
    targetCamPos = THREE.MathUtils.clamp(targetCamPos, roadStart, roadEnd);

}, {passive:false});

// Immediate Mouse/touch click
window.addEventListener("pointerdown", (e) => {

    if(isNavMove || freeCamera?.enabled) return;
    gsap.killTweensOf(navTrip);

    dragged = false
    isDragging = true;

    startX = e.clientX;
    lastXPos = e.clientX;
});

// Mouse move
window.addEventListener("pointermove", (e) => {

    // Hover detection
    if(street && !isDragging && !isNavMove && !freeCamera?.enabled && e.pointerType !== "touch") {

        const target = detectHover(e);

        // Update hovered object
        hover.setHovered(target);
        document.body.style.cursor = target ? "pointer" : "default";
    }

    // Prevent unnecessary movement
    if(isNavMove || freeCamera?.enabled || !isDragging) return;

    // Finger movement threshold
    const threshold = e.pointerType === "touch" ? 10 : 3;

    if(Math.abs(e.clientX - startX) > threshold) {
        dragged = true;
    }

    const delta = lastXPos - e.clientX;
    const speed = e.pointerType === "touch" ? MOBILE_DRAG_SPEED : DRAG_SPEED;

    targetCamPos += delta * speed;
    targetCamPos = THREE.MathUtils.clamp(targetCamPos, roadStart, roadEnd);

    lastXPos = e.clientX;
});

// Immediate Mouse/touch release
window.addEventListener("pointerup", (e) => {

    isDragging = false;
    if(!street || dragged || isNavMove || freeCamera?.enabled) return;

    const target = detectHover(e);

    if(e.pointerType === "touch") {

        setHoverSound(false);
        hover.setHovered(target);
        setHoverSound(true);
    }

    if(!target) return;

    const name = target.name.toLowerCase();
    const loc = locationKeys.find(k => name.startsWith(k));

    if(!loc) return;

    if(e.pointerType === "touch") {

        hoverHoldUntil = performance.now() + HOVER_HOLD;
        navTo(loc);
    }
    else {

        hover.setHovered(null);
        navTo(loc);
    }
});

// Drag reset for touch
window.addEventListener("pointercancel", () => {

    isDragging = false;
    dragged = false;
});

// Arrow keys
window.addEventListener("keydown", (e) => {

    // Prevent unnecessary movement
    if(isNavMove || freeCamera?.enabled) return;

    gsap.killTweensOf(navTrip);

    if(e.key === "ArrowRight") targetCamPos += KEY_MOVE;
    if(e.key === "ArrowLeft") targetCamPos -= KEY_MOVE;

    // Prevent leaving street
    targetCamPos = THREE.MathUtils.clamp(targetCamPos, roadStart, roadEnd);

}, {passive:false});

// VISUALS ----------------------------------------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    logarithmicDepthBuffer: true
});

// Resize display port
function resize() {

    const rect = canvas.getBoundingClientRect();

    sizes.width = rect.width;
    sizes.height = rect.height;

    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    // Cap the pixel ratio
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(sizes.width, sizes.height, false);
};

resize();
window.addEventListener("resize", resize);
window.visualViewport?.addEventListener("resize", resize);

// Loaders -----------------------------------------------------------------------------------------------------------------------

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

// Model manager
const modelManager = createModelManager({scene, gltfLoader});

// Scene transition
const transition = createTransitions({duration: 0.6});

// TEMP DAYLIGHT ------------------------------------------------------------------------------------

const skyFill = new THREE.HemisphereLight(0xeaf4ff, 0x77717a, 1.3);
const sun = new THREE.DirectionalLight(0xfff1df, 1.8);

sun.position.set(100, 200, 80);
scene.add(skyFill, sun);

// Street  visuals etc ------------------------------------------------------------------------------------

gltfLoader.load('/world_models/Main_street.glb', (gltf) => {

    street = gltf.scene;

    // Register clickable objects
    registerRaycastObjects(street);

    // Register street with model manager
    modelManager.setStreet(street);

    // Register street hover interactions
    hover.setStreet(street);
});

// Render objects
function render() {

    // Time since last frame
    const now = performance.now();
    const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    if(!freeCamera?.enabled && !isEntranceMove && !isAtEntrance){

        // Update normal camera position
        curCamPos += (targetCamPos - curCamPos) * (1 - Math.exp(-SMOOTH * dt));

        camera.position.set(210, 72, -curCamPos);
        const lookTarget = camera.position.clone().addScaledVector(forward, 100);
        camera.lookAt(lookTarget);
    }
    else if(freeCamera?.enabled){

        // Update free camera movement
        freeCamera.update(dt);
    }

    // Update hover animations and particles
    const hoverBlocked = (isNavMove && performance.now() > hoverHoldUntil) || (isDragging && dragged) || freeCamera?.enabled;
    hover.update(hoverBlocked);

    renderer.render(scene, camera);
    requestAnimationFrame(render);
};

render();

// Gets entrance positions
function getEntrancePos(location){

    return {
        x: loc_entrance_coords.x,
        y: loc_entrance_coords.y,
        z: -locations[location] + loc_entrance_coords.zOffset
    }
};

// HELPERS ------------------------------------------------------------------------------------------------------------

// Control camera movement
const camEase = (t) => {

    // Acceleration 40%
    const c = 0.35;

    if(t < c) return 0.5 * (t / c) ** 2;

    // 0 to 1 through the slow down phase
    const s = (t - c) / (1 - c);

    return 0.5 + 0.5 * (1 - (1 - s) ** 2.1);
};

// Move camera to locations
window.navTo = function(location){

    playSound("click");

    // Location not found
    if(!(location in locations)){
        console.warn("No location for:", location);
        return;
    }

    // Free cam warnung
    if(freeCamera?.enabled){
        console.warn("Disable free camera before using navTo.");
        return;
    }

    document.body.style.cursor = "default";

    isNavMove = true;
    isEntranceMove = false;
    isAtEntrance = false;

    // Return cam to  normal pos
    camera.position.set(210, 72, -curCamPos);

    const lookTarget = camera.position.clone().addScaledVector(forward, 100);
    camera.lookAt(lookTarget);

    // Navigat to location
    navDest = locations[location];
    navTrip.pos = curCamPos;

    gsap.killTweensOf(navTrip);
    gsap.killTweensOf(camera.position);

    // Longer trips take longer 
    const duration = THREE.MathUtils.clamp(Math.abs(navDest - curCamPos) / 600,0.9,1.6);

    // PART 1 of travel----------------------------------------------------------------------------------------------------
    gsap.to(navTrip,{

        pos: navDest,
        duration,
        ease: camEase,

        onUpdate: () => {

            // Move both together
            curCamPos = navTrip.pos;
            targetCamPos = navTrip.pos;
        },

        onComplete: () => {

            // Land on sign
            curCamPos = navDest;
            targetCamPos = navDest;
            
            // Check if entrance + guard
            const entrance = entranceLocations[location];
            if(!entrance){
                isNavMove = false;
                return;
            }

            // PART 2 of travel ----------------------------------------------------------------------------------------
            isEntranceMove = true;

            gsap.to(camera.position,{

                x: entrance.x,
                y: entrance.y,
                z: entrance.z,

                duration: 1,
                ease: "power2.inOut",

                onUpdate: () =>{

                    // Keep looking at same direction
                    camera.lookAt(
                        entrance.x + forward.x * 100,
                        entrance.y + forward.y * 100,
                        entrance.z + forward.z * 100

                    )
                },
                onComplete: () => {

                    isEntranceMove = false;
                    isAtEntrance = true;
                    isNavMove = false;
                }
            });
        }
    });
};

// Detect mouse hover over clickable object
function detectHover(e){

    const rect = canvas.getBoundingClientRect();

    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(rayCastObjects, true);

    if(!hits.length) return null;

    return hits[0].object.userData.target || null;
};

// Detection of raycast objs
function registerRaycastObjects(model){

    // Clear objects belonging to previous model
    rayCastObjects.length = 0;

    model.traverse((child) => {

        if(child.name.includes("Raycaster")){

            rayCastObjects.push(child);

            child.traverse((part) => {
                part.userData.target = child;
            });
        }
    });
}

// TEMP: Test interior loading
window.testInterior = async function(location = 'projects'){

    const interiorConfig = interiors[location];

    if(!interiorConfig){
        console.warn("No interior found for:", location);
        return;
    }

    try{

        // Load and display interior
        const interior = await modelManager.enterInterior(
            location,
            interiorConfig.path
        );

        // Register interior interactions without particles
        hover.registerModel(interior, {particles: false});
        hover.setActiveModel(interior);

        // Switch raycasting to interior
        registerRaycastObjects(interior);

        // Apply the interior's camera settings
        const cameraSettings = interiorConfig.camera;

        if(cameraSettings){
            camera.position.copy(cameraSettings.position);
            camera.lookAt(cameraSettings.target);
        }

        isAtEntrance = true;

        console.log("Interior loaded:", location);

    }
    catch(error){
        console.error("Failed to load interior:", error);
    }
};

// Cam position helper  -------------------------------------------------------------------------------------
const DEBUC_CAM = true;

if(DEBUC_CAM){

    setInterval(() => {

        if(!freeCamera?.enabled) return;

        console.log({

            x: Number(camera.position.x.toFixed(2)),
            y: Number(camera.position.y.toFixed(2)),
            z: Number(camera.position.z.toFixed(2)),
            rotationX: Number(THREE.MathUtils.radToDeg(camera.rotation.x).toFixed(2)),
            rotationY: Number(THREE.MathUtils.radToDeg(camera.rotation.y).toFixed(2)),
            rotationZ: Number(THREE.MathUtils.radToDeg(camera.rotation.z).toFixed(2))

        });

    }, 3000);
}


// 7:29:12,
// 7:40: 12 socials
// 7:56;00 fonts
