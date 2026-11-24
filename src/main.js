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
    
    start: 327,                             // navTo("start")
    projects: 596,                      // navTo("projects")
    experience: 858,                 // navTo("experience")
    skills: 1125,                            // navTo("skills")
    about: 1385,                 // navTo("about")    
    tools_platforms: 1575,         // navTo("tools_platforms")
    contact: 1610,               // navTo("contact")
    more_coming: 1925           // navTo("more_coming")
}

// Three JS setup 
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xbfd8f0);

const camera = new THREE.PerspectiveCamera(FOV, 1, 3, 850);
const forward = new THREE.Vector3(
    -Math.cos(PITCH) * Math.cos(YAW),
    -Math.sin(PITCH),
    -Math.cos(PITCH) * Math.sin(YAW)
);

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

    // Prevent unecessary movement
    if(isNavMove || !isDragging) return;

    if(Math.abs(e.clientX - startX) > 3){

        dragged = true;
    };

    const delta = lastXPos - e.clientX;

    // Move camera
    targetCamPos += delta * 0.3;
    
    // Prevent leaving street
    targetCamPos = THREE.MathUtils.clamp(targetCamPos, roadStart, roadEnd);
    lastXPos = e.clientX;
});

// Immediate Mouse/touch release
window.addEventListener("pointerup", (e) => {

    isDragging = false;
});

// Mouse click
window.addEventListener("click", (e) =>{

    // Prevent uncessary movement
    if (!street || dragged || isNavMove) return;

    // Convert coords into three coords
    mouse.x = (e.clientX / sizes.width) * 2-1;
    mouse.y = -(e.clientY / sizes.height) * 2+1;

    // Create raycast and check collision
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(street, true);

    if(!hits.length) return;

    // Get clicked object
    let obj = hits[0].object;
    while (obj){

        const place = Object.keys(locations).find(k => obj.name.toLowerCase().startsWith(k));

        if (place){ 
            navTo(place); 

        break; 
        }
        obj = obj.parent;
    }
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

const renderer = new THREE.WebGLRenderer({canvas, antialias: true, logarithmicDepthBuffer: true});

// Resize display port
function resize(){

    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio))
    renderer.setSize(sizes.width, sizes.height);
}

resize();
window.addEventListener("resize", resize)

// Loaders
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader);

// TEMP DAYLIGHT  ------------------------------------------------------------------------------------
const skyFill = new THREE.HemisphereLight(0xeaf4ff, 0x77717a, 1.3);
const sun = new THREE.DirectionalLight(0xfff1df, 1.8);
sun.position.set(100, 200, 80);
scene.add(skyFill, sun);

// Load main street
gltfLoader.load('/world_models/Main_street.glb', (gltf) => {
    street = gltf.scene;
    scene.add(street);
});

// Render objects
function render(){
    
    // Udpate camera pos
    curCamPos += (targetCamPos - curCamPos) * 0.08

    // give control back (temproary) 
    if (isNavMove && Math.abs(targetCamPos - curCamPos) < 10) isNavMove = false;   // TEMP: remove once signs open buildings
    camera.position.set(210, 72, -curCamPos);
    
    const lookTarget = camera.position.clone().addScaledVector(forward, 100);
    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
    requestAnimationFrame(render);
}

render()

// Move camera to locations
window.navTo = function(location){

    if(!(location in locations)){
        console.warn("No location for:", location);
        return;
    }

    isNavMove = true;   
    targetCamPos = locations[location];
}

// HELPERS ----------------------------------------------------------

// Check camera pos
// let lastLoggedPos = -1;

// setInterval(() => {
//     const roundedPos = Math.round(curCamPos);

//     if (roundedPos !== lastLoggedPos) {

//         console.log("Camera:", roundedPos);
//         lastLoggedPos = roundedPos;
//     }

// }, 1000);