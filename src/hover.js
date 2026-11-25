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
export function createHover({scene, camera}){

    // Current hover object
    let curHoverObj = null;

    // Store hoverable objects
    const hoverObjs = new Map();

    // Store obj with active animations
    const activeObjs = new Set();

    // Time between frames
    let a_time = performance.now();

    // Vector to create new vecs
    const tempVec = new THREE.Vector3();

    // Create glow textures
    const HALO_TEX = createGlowTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0.25)');
    const SPARK_TEX = createGlowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.35)');

    // Particle system (data)
    const sparks = {

        // Particle coords
        pos: new Float32Array(MAX_SPARKS * 3),

        // Particle colours
        col: new Float32Array(MAX_SPARKS * 3),

        // Movement dir and speed
        val: new Float32Array(MAX_SPARKS * 3),

        // Remaining lifetime
        life: new Float32Array(MAX_SPARKS),

        // Max Lifetime
        max: new Float32Array(MAX_SPARKS),

        // Gravity
        grav: new Float32Array(MAX_SPARKS),

        // Size multiplier
        size: new Float32Array(MAX_SPARKS),

        // Indiviudal colours
        tint: new Array(MAX_SPARKS).fill(null),

        // Index of next particle slot
        next: 0,

        alive: 0
    };

    // Geometry to hold particle data
    const sparkGeo = new THREE.BufferGeometry();

    // Connect particle arrays to geometry attributes
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparks.pos, 3));
    sparkGeo.setAttribute('color',new THREE.BufferAttribute(sparks.col, 3));
    sparkGeo.setAttribute('aSize',new THREE.BufferAttribute(sparks.size, 1));

    // Create particle material
    const sparkMat = new THREE.PointsMaterial({
        size: 1,
        map: SPARK_TEX,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });

    // Customise vertex shader to support individual particle sizes
    sparkMat.onBeforeCompile = (sh) => {

        // Add custom size attribute
        sh.vertexShader = sh.vertexShader.replace('void main() {','attribute float aSize;\nvoid main() {')
        
        // Multiply default point size by particle size
        .replace('gl_PointSize = size;','gl_PointSize = size * aSize;');
    };
};

// Create particle system
const sparks = new THREE.Points(sparkGeo, sparkMat);

// Prevent particles from being incorrectly deleted
sparks.frustumCulled = false;

// Render particles above scene objects
sparks.renderOrder = 10;

// Add particle system to scene
sparks.add(sparks);

// SPARK FUNCTIONS -------------------------------------------------------------------------------------------------

// Spawn sparls
function spawnSpark(rec, speedMul){

    // Get next available particle slot
    const i = sparks.next;

    // Move to next slot
    sparks.next = (sparks.next + 1) % MAX_SPARKS;

    // Check if slot  already in use
    if(sparks.life[i] <= 0){
        sparks.alive++;
    }

    // Scale relative to the reference board 
    const scale = Math.min(rec.height / 0.72, rec.width / 2.1);

    const centre = rec.wCenter;
    const widthAxis = rec.widthAxis;
    const normal = rec.normal;

    // Determine camera angle to sign
    const toCam = tempVec.subVectors(camera.position, centre);
    const normalDir = Math.sign(toCam.dot(normal)) || 1;

    // Random position along the sign's width
    const alongW = (Math.random() - 0.5) * rec.width;

    // Randomly choose the top or bottom edge
    const edge = (Math.random() < 0.5 ? 1 : -1) * rec.height * 0.5;

    // Spawn slightly in front of the sign
    const out = normalDir * (rec.depth * 0.5 + 0.1 * scale);

    // Set particle pos
    sparks.pos[i * 3] = centre.x + widthAxis.x * alongW + normal.x * out;
    sparks.pos[i * 3 + 1] = centre.y + edge;
    sparks.pos[i * 3 + 2] = centre.z + widthAxis.z * alongW + normal.z * out;

    // Random movement along the sign's width
    const vAlong = (Math.random() - 0.5) * 1.6 * scale * speedMul;

    // Random upward movement
    const vUp = (0.5 + Math.random() * 1.5) * scale * speedMul;

    // Small movement away from the sign
    const vOut = normalDir * Math.random() * 0.9 * scale;

    // Set particle velocity
    sparks.val[i * 3] = widthAxis.x * vAlong + normal.x * vOut;
    sparks.val[i * 3 + 1] = vUp;
    sparks.val[i * 3 + 2] = widthAxis.z * vAlong + normal.z * vOut;

    // Set particle lifetime (0.5 - 1.1 seconds)
    sparks.life[i] = sparks.max[i] = 0.5 + Math.random() * 0.6;

    // Set particle gravity
    sparks.grav[i] = 3.2 * scale;

    // Store sign colour for this particle
    sparks.tint[i] = rec.glowColor;

    // Set individual particle size
    sparks.size[i] = Math.min((0.16 + Math.random() * 0.12) * scale, 3);
}

// Update all sparks
function updateSparks(dt){
    
    // Generate sparks on sign hover
    if(curHoverObj && curHoverObj.isSign && curHoverObj.state.sparks > 0.5){

        // Accumulate sparks
        curHoverObj.spawnAcc += SIGN.sparkRate * dt;

        // Spawn a spark for every accumulated  number
        while(curHoverObj.spawnAcc >= 1){

            spawnSpark(curHoverObj);
            curHoverObj.spawnAcc -= 1;
        }
    }

    // Skip particle loop if  no active sparks
    if(sparks.alive === 0) return;

    // Update each active particle
    for(let i = 0; i < MAX_SPARKS; i++){

        // Skip inactive particles
        if(sparks.life[i] <= 0) continue;

            // Reduce remaining lifetime
            sparks.life[i] -= dt;

            // Check if particle expire
            if(sparks.life[i] <= 0){

                // Reduce active particle count
                sparks.alive--;

                // Remove particle colour
                sparks.col[i * 3] = 0;
                sparks.col[i * 3 + 1] = 0;
                sparks.col[i * 3 + 2] = 0;

                continue;
            }

            // Apply gravity to vertical movement
            sparks.val[i * 3 + 1] -= sparks.grav[i] * dt;

            // Update particle position
            sparks.pos[i * 3] += sparks.val[i * 3] * dt;
            sparks.pos[i * 3 + 1] += sparks.val[i * 3 + 1] * dt;
            sparks.pos[i * 3 + 2] += sparks.val[i * 3 + 2] * dt;

            // Calculate remaining lifetime percentage
            const fade = Math.max(sparks.life[i], 0) / sparks.max[i];

            // Get particle colour
            const tint = sparks.tint[i];

            // Update particle colour and fade
            sparks.col[i * 3] = tint.r * fade + fade * 0.45;
            sparks.col[i * 3 + 1] = tint.g * fade + fade * 0.45;
            sparks.col[i * 3 + 2] = tint.b * fade + fade * 0.45;
    }

    // update particle data on GPU
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
    sparkGeo.attributes.aSize.needsUpdate = true;
};
