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

const signList = [];


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

// Mouse vars
let isDragging = false;
let lastXPos = 0;

// Locations
const locations ={

    start: 327,                             // navTo("start")
    projects: 596,                      // navTo("projects")
    experience: 858,                 // navTo("experience")
    skills: 1125,                            // navTo("skills")
    about_Me: 1385,                 // navTo("about_Me")    
    tools_Platforms: 1575,         // navTo("tools_Platforms")
    contact_Me: 1610,               // navTo("contact_Me")
    coming_Soon: 1925           // navTo("coming_Soon")
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

    e.preventDefault()
    targetCamPos += e.deltaY * 0.3;

    // Prevent leaving street
    targetCamPos = THREE.MathUtils.clamp(targetCamPos, roadStart, roadEnd);
    
}, {passive:false});

// Immediate Mouse/touch click
window.addEventListener("pointerdown", (e) => {

    isDragging = true;
    lastXPos = e.clientX;
});

// Mouse/touch move
window.addEventListener("pointermove", (e) => {

    if (!isDragging) return;

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

    // Convert coords into three coords
    mouse.x = (e.clientX / sizes.width) * 2-1;
    mouse.y = (e.clientY / sizes.height) * 2+1;

    // Create raycast and check collision
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(signList, true);

    if (hits.length > 0) {

        // Get the group that contains the clicked mesh
        let clickedObject = hits[0].object;

        while (clickedObject.parent && !signList.includes(clickedObject)) {
            clickedObject = clickedObject.parent;
        }

        console.log("Clicked sign:", clickedObject.name);
});

// Arrow keys
window.addEventListener("keydown", (e) => {

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

///////// TEMP DAYLIGHT 
const skyFill = new THREE.HemisphereLight(0xeaf4ff, 0x77717a, 1.3);
const sun = new THREE.DirectionalLight(0xfff1df, 1.8);
sun.position.set(100, 200, 80);
scene.add(skyFill, sun);

// Load main street
gltfLoader.load('/world_models/Main_street.glb', ({ scene: street }) => {

    street.traverse((obj) =>{

        if(
            obj.name === "Projects_Sign" ||
            obj.name === "Experience_Sign" ||
            obj.name === "skills_Sign" ||
            obj.name === "About_me_Sign" ||
            obj.name === "Contact_Sign" ||
            obj.name === "More_coming_Sign"
        )
        {
            signList.push(obj);
            console.log("Clcikd", obj.name, obj.type)
        }
    });

    scene.add(street);
});

// Render objects
function render(){
    
    // Udpate camera pos
    curCamPos += (targetCamPos - curCamPos) * 0.08
    camera.position.set(210, 72, -curCamPos);
    
    const lookTarget = camera.position.clone().addScaledVector(forward, 100);
    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
    requestAnimationFrame(render);
}

render()

window.navTo = function(location){

    targetCamPos = locations[location]
    console.log("moving")
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