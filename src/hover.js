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
const isSign = (n) => n.includes('_Button_Raycaster') || n.includes('_Sign_') || n.includes('Site_Board');

// Objects with suffix shouldn't move
const isStand = (n) =>  /_Stand$/.test(n);

// HELPERS -------------------------------------------------------------------------------------------------------------

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

// Find object vertical-axis
function findUpAxis(obj){

    // Get object rotation
    const worldRotation = obj.getWorldQuaternion(new THREE.Quaternion());

    // Default to Y + closest alignment
    let bestAxis = 1, bestDot = -1;

    // Check axes
    ['x', 'y', 'z'].forEach((_, index) => {

        // Create direction vector
        const axis = new THREE.Vector3().setComponent(index, 1).applyQuaternion(worldRotation);

        // Compare against y axis
        if(Math.abs(axis.y) > bestDot){

            // Store vertical axis (closest)
            bestDot = Math.abs(axis.y);
            bestAxis = index;
        }
    });

    return bestAxis;
};

// Check if invisible hitbox
const isHitBox = (obj) => {
    return obj.name.includes('_Hitbox');
};

// Get relevant object messhes
function getMeshes(obj, meshes = []){

    // Check if obj is mesh
    if(obj.isMesh && !isHitBox(obj)){
        meshes.push(obj);
    }

        // Go through every child of the current object.
    obj.children.forEach((child) => {

        // in the animated object's bounding box.
        if (!isStand(child.name)) {

            // Recursively check  child and children.
            getMeshes(child, meshes);
        }
    });

    return meshes;
};

// Calculate bounding box of object mesh
// Calculate scaling / effect positions
function getBoundingBox(obj, worldSpace = false){

    // Init bound box
    const boundBox = new THREE.Box3();

    // Determine coord space
    const inverseMat = worldSpace ? new THREE.Matrix4() : obj.matrixWorld.clone().invert();

    // Convert mesh coords
    const meshMat = new THREE.Matrix4();

    // Get all meshes in object
    for(const mesh of getMeshes(obj)){

        // Check if existing bound box
        if(!mesh.geometry.boundingBox){
            mesh.geometry.computeBoundingBox();
        }

        meshMat.multiplyMatrices(inverseMat, mesh.matrixWorld);

        // Transform mesh bound box and merge into main box
        boundBox.union(mesh.geometry.boundingBox.clone().applyMatrix4(meshMat));
    }

    return boundBox;
};

// MAIN HOVER FUNCTION ----------------------------------------------------------------------------------------
