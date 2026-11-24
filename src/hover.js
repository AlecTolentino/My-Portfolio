import * as THREE from 'three';
import gsap from 'gsap';

// MAIN VARS
const HOVER_TAG = "Hover";
const MAX_SPARKS = 400;

// Sign vars
const SIGN = {
    neonBoost: 1.0,
    faceTint: 0.28,             // Brightness increase for non-neon surfaces
    halo: 0.6,         
    sparkRate: 50,              
    sparkBurst: 14             // Sparks generated immediately on hover
};

// Building vars
const BUILDING = {
    neonBoost: 0.8,
    faceTint: 0.22
};

// Assigns animation to sign 
const isSign = (n) => n.includes('_Button_Raycaster') || n.includes('_Sign_') || n.includes('Site_Board');;

// Objects with suffix shouldn't move
const isStand = (n) =>  /_Stand$/.test(n);

// HELPERS -------------------------------------------------------------

// Create glow texture
function createGlowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)'){

    // Create canvas to draw on
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;

    const context = canvas.getContext('2d');

    // Create circular gradient
    const grad = context.createRadialGradient(64, 64, 0, 64 ,64, 64);

    // Change colour and transparency
    grad.addColorStop(0, inner);                                        // Centre: brightest
    grad.addColorStop(0.35, mid);                                // Middle: partially transparent
    grad.addColorStop(1, 'rgba(255,255,255,0)');          // Edge: completely transparent

    // Apply and draw gradient
    context.fillStyle = grad;
    context.fillRect(0, 0, 128, 128);

    // Convert into threejs texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
};

// Find object z-axis
function findZAxis(obj){

    // Get object rotation
    const worldRotation = obj.getWorldQuaternion(new THREE.Quaternion());

    // Default to Y + how close to z
    let bestAxis = 1;
    let bestDot = -1;

    // Check axes
    ['x', 'y', 'z'].forEach((_, index) => {

        // Create direction vector
        const axis = new THREE.Vector3().setComponent(index, 1).applyQuaternion(worldRotation);

        // Compare against y axis
        if(Math.abs(axis.y) > bestDot){

            // Store z axis (closest)
            bestDot = Math.abs(axis.y);
            bestAxis = index;
        }
    }
};