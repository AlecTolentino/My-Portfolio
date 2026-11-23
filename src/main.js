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
    targetCamPos += e.deltaY * 0.5;

    // Prevent leaving street
    targetCamPos = THREE.MathUtils.clamp(targetCamPos, roadStart, roadEnd);
    
}, {passive:false});

// Mouse click
window.addEventListener("pointerdown", (e) => {

    isDragging = true;
    lastXPos = e.clientX;
});

// Mouse move
window.addEventListener("pointermove", (e) => {

    if (!isDragging) return;

    const delta = lastXPos - e.clientX;

    // Move camera
    targetCamPos += delta * 0.3;
    
    // Prevent leaving street
    targetCamPos = THREE.MathUtils.clamp(targetCamPos, roadStart, roadEnd);
    lastXPos = e.clientX;
});

// Mouse release
window.addEventListener("pointerup", (e) => {

    isDragging = false;
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

    const streetBounds = new THREE.Box3().setFromObject(street);
    //console.log("bounds", streetBounds)

    scene.add(street)
});

// Render objects
function render(){

    curCamPos += (targetCamPos - curCamPos) * 0.08;

    camera.position.set(220, 72, -curCamPos);
    const lookTarget = camera.position.clone().addScaledVector(forward, 100);

    camera.lookAt(lookTarget);

    renderer.render(scene, camera);
    requestAnimationFrame(render);
}

render()

