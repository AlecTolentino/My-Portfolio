import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

import './style.scss'

const canvas = document.querySelector("#experience-canvas")

// MAIN VARS  ------------------------------------------------------------------------------------------------------------
const sizes = {

    width: window.innerWidth,
    height: window.innerHeight
}

const FOV = 68
const PITCH = THREE.MathUtils.degToRad(12);
const YAW = THREE.MathUtils.degToRad(0.85);

let  curCamPos = 315
let targetCamPos = 315

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

// Scrolling
window.addEventListener("wheel", (e) =>{

    e.preventDefault()
    curCamPos += e.deltaY * 0.5;

    // Prevent leaveing street
    curCamPos = THREE.MathUtils.clamp(curCamPos, 90, 2255);
    
}, {passive:false});

// Arro keys
window.addEventListener("keydown", (e) => {

    if (e.key === "ArrowRight") {
        curCamPos += 10;
    }

    if (e.key === "ArrowLeft") {
        curCamPos -= 10;
    }
    
    // Prevent leaveing street
    curCamPos = THREE.MathUtils.clamp(curCamPos, 90, 2255);
    
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
gltfLoader.load('/world_models/Main_street.glb',

    ({ scene: street }) => scene.add(street),undefined,
    (error) => console.error('Could not load Main Street:', error)
);

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

