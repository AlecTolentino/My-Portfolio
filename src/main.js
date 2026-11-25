import * as THREE from 'three';
import gsap from 'gsap';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createHover} from './hover.js';
import {playSound, setHoverSound} from './sound.js';

import './style.scss'

const canvas = document.querySelector("#experience-canvas")
canvas.style.touchAction = "none";

// Stop text selection, the long-press menu and the magnifier loupe on touch screens
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("selectstart", (e) => e.preventDefault());

// MAIN VARS  ------------------------------------------------------------------------------------------------------------
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
let  curCamPos = 315
let targetCamPos = 315

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

// phone control
const HOVER_HOLD = 600;
let hoverHoldUntil = 0;                     // timestamp until which hover may keep playing

// hover animation plays and then speeds up
let navDest = 0;           
const navTrip = {pos: 0};       
const NAV_RELEASE = 10;                 // give control back this close to the destination

// Pointer positions
let startX = 0
let lastXPos = 0;

// Locations
const locations ={
    start: 314,
    projects: 592,
    experience: 854,
    skills: 1120,
    about: 1390,
    tools_platforms: 1575,
    contact: 1605,
    more_coming: 1927
}

const socials = {
    "Github":  "https://github.com/AlecTolentino",
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

// raycasting
const locationKeys = Object.keys(locations).sort((a,b) => b.length - a.length);

// Hover
const hover = createHover({scene, camera});

// EVENT LISTENERS ------------------------------------------------------------------------------------------------------
// Wheel scrolling
window.addEventListener("wheel", (e) =>{

    // Prevent unecessary movement
    e.preventDefault()
    if(isNavMove) return;

    gsap.killTweensOf(navTrip);

    targetCamPos += e.deltaY * SCROLL_SPEED;

    // Prevent leaving street
    targetCamPos = THREE.MathUtils.clamp(targetCamPos, roadStart, roadEnd);

}, {passive:false});

// Immediate Mouse/touch click
window.addEventListener("pointerdown", (e) => {

    // Prevent unecessary movement
    if(isNavMove) return;

    gsap.killTweensOf(navTrip);

    dragged = false
    isDragging = true;

    startX = e.clientX;
    lastXPos = e.clientX;
});

// Mouse / finger move
window.addEventListener("pointermove", (e) => {

    // Hover detection 
    if(street && !isDragging && !isNavMove && e.pointerType !== "touch"){

        const target = detectHover(e);

        // Update hovered object
        hover.setHovered(target);
        document.body.style.cursor = target ? "pointer" : "default";
    }

    // Prevent unecessary movement
    if(isNavMove || !isDragging) return;

    // Finger movement threshold
    const threshold = e.pointerType === "touch" ? 10 : 3;
    if(Math.abs(e.clientX - startX) > threshold) dragged = true;

    const delta = lastXPos - e.clientX;

    // Move camera + Prevent leaving street
    const speed = e.pointerType === "touch" ? MOBILE_DRAG_SPEED : DRAG_SPEED;
    targetCamPos += delta * speed
    ;
    targetCamPos = THREE.MathUtils.clamp(targetCamPos, roadStart, roadEnd);
    lastXPos = e.clientX;
});

// Immediate Mouse/touch release
window.addEventListener("pointerup", (e) => {

    isDragging = false;

    // Click / tap if no drag
    if(!street || dragged || isNavMove) return;

    const target = detectHover(e);

    // Touch: highlight whatever was tapped 
    if(e.pointerType === "touch"){ 
        
        setHoverSound(false);
        hover.setHovered(target);
        setHoverSound(true);
    }

    // Ignore if nothing clickable was hit
    if(!target) return;

    const name = target.name.toLowerCase();
    const loc = locationKeys.find(k => name.startsWith(k));

    if(!loc) return;

    if(e.pointerType === "touch"){

        // Keep hover animation alive while camera starts moving
        hoverHoldUntil = performance.now() + HOVER_HOLD;
        navTo(loc);
    }
    else{

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

    // Prevent uncessary movement
    if(isNavMove) return;

    gsap.killTweensOf(navTrip);

    if(e.key === "ArrowRight") targetCamPos += KEY_MOVE;
    if(e.key === "ArrowLeft") targetCamPos -= KEY_MOVE;

    // Prevent leaving street
    targetCamPos = THREE.MathUtils.clamp(targetCamPos, roadStart, roadEnd);

}, {passive:false});

// VISUALS ----------------------------------------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({canvas, antialias: true, logarithmicDepthBuffer: true});

// Resize display port
function resize(){

    const rect = canvas.getBoundingClientRect();

    sizes.width = rect.width;
    sizes.height = rect.height;

    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    // Cap the pixel ratio: a phone with a ratio of 3 would otherwise draw 9x the pixels
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

// TEMP DAYLIGHT  ------------------------------------------------------------------------------------
const skyFill = new THREE.HemisphereLight(0xeaf4ff, 0x77717a, 1.3);
const sun = new THREE.DirectionalLight(0xfff1df, 1.8);
sun.position.set(100, 200, 80);
scene.add(skyFill, sun);

// Load main street ------------------------------------------------------------------------------------
gltfLoader.load('/world_models/Main_street.glb', (gltf) => {
    street = gltf.scene;

    // Remember clickable items
    street.traverse((child) => {

        if(child.name.includes("Raycaster")){

            rayCastObjects.push(child);
            child.traverse((part) => {part.userData.target = child;});
        }
    });

    scene.add(street);
    hover.setStreet(street);
});

// Render objects
function render(){

    // TIme since last frame
    const now = performance.now();
    const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    // Udpate camera pos
    curCamPos += (targetCamPos - curCamPos) * (1- Math.exp(-SMOOTH * dt));

    if(isNavMove && Math.abs(navDest - curCamPos) < NAV_RELEASE){   // TEMP: remove once signs open buildings
        isNavMove = false;     
    }

    camera.position.set(210, 72, -curCamPos);
    const lookTarget = camera.position.clone().addScaledVector(forward, 100);
    camera.lookAt(lookTarget);

    // Update hover animations and particles
    // While travelling, hover is blocked - except for a short hold after touch tap
    const hoverBlocked = (isNavMove && performance.now() > hoverHoldUntil) || (isDragging && dragged);
    hover.update(hoverBlocked);

    renderer.render(scene, camera);
    requestAnimationFrame(render);
};

render();

// HELPERS ----------------------------------------------------------

// Control cam movement
const camEase = (t) => {

     //  Acceleration 40%
    const c = 0.35;   

    if(t < c) return 0.5 * (t / c) ** 2;    

     // 0 to 1 through the slow down phase
    const s = (t - c) / (1 - c);           
    return 0.5 + 0.5 * (1 - (1 - s) ** 2.1); 
};

// Move camera to locations
window.navTo = function(location){

    playSound("click");

    if(!(location in locations)){
        console.warn("No location for:", location);
        return;
    }

    document.body.style.cursor = "default";
    isNavMove = true;

    navDest = locations[location];
    navTrip.pos = curCamPos;
    gsap.killTweensOf(navTrip);

    // Longer trips take longer
    const duration = THREE.MathUtils.clamp(Math.abs(navDest - curCamPos) / 600, 0.9, 1.6);

    gsap.to(navTrip, {
        pos: navDest,
        duration,
        ease: camEase,           // slow start, fast middle, soft landing

        onUpdate: () => {

            // Move both together
            curCamPos = navTrip.pos;
            targetCamPos = navTrip.pos;
        },

        onComplete: () => {

            // Land on sign
            curCamPos = navDest;
            targetCamPos = navDest;
            isNavMove = false;       // TEMP: remove once signs open buildings
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

// Check camera pos
// let lastLoggedPos = -1;

// setInterval(() => {
//     const roundedPos = Math.round(curCamPos);

//     if (roundedPos !== lastLoggedPos) {

//         console.log("Camera:", roundedPos);
//         lastLoggedPos = roundedPos;
//     }

// }, 1000);


// 7:29:12,
// 7:40: 12 socials
// 7:56;00 fonts