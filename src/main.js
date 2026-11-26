import * as THREE from 'three';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import './style.scss'

// Custom imps
import {createStreetCamera} from './cameras/streetCam.js';
import {createFreeCamera} from './cameras/freeCam.js';
import {createHover} from './interactions/hover.js';
import {createRaycasting} from './interactions/raycasting.js';
import {createModelManager } from './systems/modelManager.js'
import {playSound, setHoverSound} from './systems/sound.js';
import {createTransitions} from './systems/transitions.js';
import {interiors} from './world/interiors.js';


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

let street = null;
let lastFrameTime = performance.now();

// Movement vars
let isDragging = false;
let dragged = false;
const DRAG_SPEED = 0.25;
const MOBILE_DRAG_SPEED = 0.6;

// Phone control
const HOVER_HOLD = 600;
let hoverHoldUntil = 0;

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

const camera = new THREE.PerspectiveCamera(68, 1, 3, 850);

// Street cam controller
const streetCam = createStreetCamera({camera, locations, entranceLocations, onNavigate: () => playSound("click")});

// Raycasting
const raycasting = createRaycasting({camera, canvas});
const locationKeys = Object.keys(locations).sort((a,b) => b.length - a.length);

// Hover
const hover = createHover({scene, camera});

// Free camera helper
const DEV_MODE = true;
const freeCamera = DEV_MODE ?  createFreeCamera({camera, canvas,

    onDisable: () => {

        // Synchronise street camera with the current camera position
        streetCam.syncPosition();
    }
}) : null;

// EVENT LISTENERS ------------------------------------------------------------------------------------------------------

// Wheel scrolling
window.addEventListener("wheel", (e) => {

    e.preventDefault();
    if(streetCam.isNavigating || freeCamera?.enabled) return;
    streetCam.scroll(e.deltaY);

}, {passive:false});

// Immediate Mouse/touch click
window.addEventListener("pointerdown", (e) => {

    if(streetCam.isNavigating || freeCamera?.enabled) return;

    dragged = false
    isDragging = true;

    startX = e.clientX;
    lastXPos = e.clientX;
});

// Mouse move
window.addEventListener("pointermove", (e) => {

    // Hover detection
    if(street && !isDragging && !streetCam.isNavigating && !freeCamera?.enabled && e.pointerType !== "touch") {

        const target = raycasting.detectHover(e);

        // Update hovered object
        hover.setHovered(target);
        document.body.style.cursor = target ? "pointer" : "default";
    }

    // Prevent unnecessary movement
    if(streetCam.isNavigating || freeCamera?.enabled || !isDragging) return;

    // Finger movement threshold
    const threshold = e.pointerType === "touch" ? 10 : 3;
    if(Math.abs(e.clientX - startX) > threshold) dragged =  true;

    const delta = lastXPos - e.clientX;
    const speed = e.pointerType === "touch" ? MOBILE_DRAG_SPEED : DRAG_SPEED;

    streetCam.drag(delta * speed);
    lastXPos = e.clientX;
});

// Immediate Mouse/touch release
window.addEventListener("pointerup", (e) => {

    isDragging = false;
    if(!street || dragged || streetCam.isNavigating || freeCamera?.enabled) return;

    const target = raycasting.detectHover(e);

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
    if(streetCam.isNavigating || freeCamera?.enabled) return;

    if(e.key === "ArrowRight") streetCam.moveBy(1);
    if(e.key === "ArrowLeft") streetCam.moveBy(-1);

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
    raycasting.registerModel(street);

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

    if(freeCamera?.enabled){

        freeCamera.update(dt);
    }
    else{

        // Update street camera movement
        streetCam.update(dt);
    }

    // Update hover animations and particles
    const hoverBlocked = (streetCam.isNavigating && performance.now() > hoverHoldUntil) || (isDragging && dragged) || freeCamera?.enabled;
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

// Move camera to locations
window.navTo = function(location){

    if(freeCamera?.enabled){
        console.warn("Disable free camera before using navTo.");
        return;
    }

    streetCam.navigateTo(location);
};

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
        raycasting.registerModel(interior);

        // Apply the interior's camera settings
        const cameraSettings = interiorConfig.camera;

        if(cameraSettings){
            camera.position.copy(cameraSettings.position);
            camera.lookAt(cameraSettings.target);
        }

        streetCam.setAtEntrance(true);
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
