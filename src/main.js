import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

import './style.scss'

const canvas = document.querySelector("#experience-canvas")
const sizes = {

    width: window.innerWidth,
    height: window.innerHeight
}

// Three JS setup 
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xbfd8f0);

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true});

// const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 1, 3000);
// const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });

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

// Orbit control setup
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

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

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(render);
}

render()

