import * as THREE from 'three';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';


import './style.scss'

const canvas = document.querySelector("#experience-canvas")

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

// Road vars
const roadStart = 90
const roadEnd = 2255
const roadLen = roadEnd - roadStart

// Movement vars
let isDragging = false;
let dragged = false;
let isNavMove = false

// Pointer positions
let startX = 0
let lastXPos = 0;

// Locations
const locations ={
    start: 327,                           
    projects: 596,                 
    experience: 858,                 
    skills: 1125,                    
    about: 1385,             
    tools_platforms: 1575,         
    contact: 1610,              
    more_coming: 1925          
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

// EVENT LISTENERS ------------------------------------------------------------------------------------------------------
// Wheel scrolling
window.addEventListener("wheel", (e) =>{

    // Prevent unecessary movement
    e.preventDefault()
    if(isNavMove) return;

    targetCamPos += e.deltaY * 0.3;

    // Prevent leaving street
    targetCamPos = THREE.MathUtils.clamp(targetCamPos, roadStart, roadEnd);
    
}, {passive:false});

// Immediate Mouse/touch click
window.addEventListener("pointerdown", (e) => {

    // Prevent unecessary movement
    if(isNavMove) return;

    dragged = false
    isDragging = true;

    startX = e.clientX;  
    lastXPos = e.clientX;
});

// Mouse/touch move
window.addEventListener("pointermove", (e) => {

    // Hover detection
    if(street && !isDragging && !isNavMove && e.pointerType !== "touch"){

        const target = detectHover(e);
        document.body.style.cursor = target ? "pointer" : "default";
    }

    // Prevent unecessary movement
    if(isNavMove || !isDragging) return;

    if(Math.abs(e.clientX - startX) > 3){

        dragged = true;
    }

    const delta = lastXPos - e.clientX;

    // Move camera + Prevent leaving street
    targetCamPos += delta * 0.3;
    targetCamPos = THREE.MathUtils.clamp(targetCamPos, roadStart, roadEnd);
    lastXPos = e.clientX;
});

// Immediate Mouse/touch release
window.addEventListener("pointerup", (e) => {

    isDragging = false;

    // Click / tap if no drag
    if(!street || dragged || isNavMove) return;
    
    const target = detectHover(e);
    if(!target) return;

    const name = target.name.toLowerCase();
    const loc = locationKeys.find(k => name.startsWith(k));

    if (loc) navTo(loc);
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

    if (e.key === "ArrowRight") {
        targetCamPos += 10;
    }

    if (e.key === "ArrowLeft") {
        targetCamPos -= 10;
    }

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

    renderer.setPixelRatio(Math.min(window.devicePixelRatio));
    renderer.setSize(sizes.width, sizes.height, false);
};

resize();
window.addEventListener("resize", resize);
window.visualViewport?.addEventListener("resize", resize);

// Loaders
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
});

// Render objects
function render(){
    
    // Udpate camera pos
    curCamPos += (targetCamPos - curCamPos) * 0.08;

    // give control back (temproary) 
    if (isNavMove && Math.abs(targetCamPos - curCamPos) < 10) isNavMove = false;   // TEMP: remove once signs open buildings
    camera.position.set(210, 72, -curCamPos);
    
    const lookTarget = camera.position.clone().addScaledVector(forward, 100);
    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
    requestAnimationFrame(render);
};

render();


// HELPERS ----------------------------------------------------------
// Move camera to locations
window.navTo = function(location){

    if(!(location in locations)){
        console.warn("No location for:", location);
        return;
    }

    document.body.style.cursor = "default";
    isNavMove = true;   
    targetCamPos = locations[location];
};

// Detect mouse hover over clickable object
function detectHover(e){

    const rect = canvas.getBoundingClientRect();

    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(rayCastObjects, true);

    if(!hits.length) return null;

    return hits[0].object.userData.target;
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