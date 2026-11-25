import * as THREE from 'three';
import gsap from 'gsap';
import {playSound} from './sound.js';

// MAIN VARS
const HOVER_TAG = "Hover";
const MAX_SPARKS = 100;

// Sign vars
const SIGN = {
    neonBoost: 1.0,
    faceTint: 0.28,             // Brightness increase for non-neon surfaces
    halo: 0.6,
    sparkRate: 70,
    sparkBurst: 45              // Sparks generated immediately on hover
};

// Building vars
const BUILDING = {
    neonBoost: 0.8,
    faceTint: 0.22
};

// Idle sway vars 
const SWAY = {
    roll: THREE.MathUtils.degToRad(3),                          // swing angle
    yaw: THREE.MathUtils.degToRad(2.5),                      // tiny twist on vertical axis
    speed: 7,                                                                      // radians per second (0.9 = one swing about every 7 seconds)
    range: 700                                                 
};

// Assigns animation to sign
const isSign = (n) => n.includes('_Button_Raycaster') || n.includes('_Sign_') || n.includes('Site_Board');

// Which signs may sway (the construction board is fixed to its fence, so it doesn't)
const canSway = (n) => isSign(n) && !n.includes('Site_Board');

// Objects with suffix shouldn't move
const isStand = (n) => /_Stand$/.test(n);

// HELPERS -------------------------------------------------------------------------------------------------------------

// Create glow texture
function createGlowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)'){

    // Create canvas to draw on
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;

    const context = canvas.getContext('2d');

    // Create circular gradient
    const grad = context.createRadialGradient(64, 64, 0, 64, 64, 64);

    // Change colour and transparency
    grad.addColorStop(0, inner);                              // Centre: brightest
    grad.addColorStop(0.35, mid);                            // Middle: partially transparent
    grad.addColorStop(1, 'rgba(255,255,255,0)');             // Edge: completely transparent

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
    ['x', 'y', 'z'].forEach((_, index) =>{

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
const isHitBox = (obj) =>{
    return obj.name.includes('_Hitbox');
};

// Get relevant object meshes
function getMeshes(obj, meshes = []){

    // Check if obj is mesh
    if(obj.isMesh && !isHitBox(obj)){
        meshes.push(obj);
    }

    // Go through every child of the current object
    obj.children.forEach((child) =>{

        // Exclude stands from the animated object's bounding box
        if(!isStand(child.name)){

            // Recursively check child and children
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

    // Signs that sway when idle
    const swayRecords = [];
    let swayTime = 0;                       // seconds, drives the sway waves

    // Time between frames
    let a_time = performance.now();

    // Vector to create new vecs
    const tempVec = new THREE.Vector3();

    // Scratch objects for the sway maths (reused every frame so nothing is allocated)
    const swayQuat = new THREE.Quaternion();
    const swayQuatB = new THREE.Quaternion();
    const swayVecA = new THREE.Vector3();
    const swayVecB = new THREE.Vector3();

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

        // Individual colours
        tint: new Array(MAX_SPARKS).fill(null),

        // Index of next particle slot
        next: 0,

        alive: 0
    };

    // Geometry to hold particle data
    const sparkGeo = new THREE.BufferGeometry();

    // Connect particle arrays to geometry attributes
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparks.pos, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparks.col, 3));
    sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(sparks.size, 1));

    // Allow frequent particle updates
    sparkGeo.attributes.position.setUsage(THREE.DynamicDrawUsage);
    sparkGeo.attributes.color.setUsage(THREE.DynamicDrawUsage);
    sparkGeo.attributes.aSize.setUsage(THREE.DynamicDrawUsage);

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
    sparkMat.onBeforeCompile = (sh) =>{

        // Add custom size attribute
        sh.vertexShader = sh.vertexShader.replace('void main() {','attribute float aSize;\nvoid main() {');

        // Multiply default point size by particle size
        sh.vertexShader = sh.vertexShader.replace('gl_PointSize = size;','gl_PointSize = size * aSize;');
    };

    // Create particle system
    const sparkParticles = new THREE.Points(sparkGeo, sparkMat);

    // Prevent particles from being incorrectly deleted
    sparkParticles.frustumCulled = false;

    // Render particles above scene objects
    sparkParticles.renderOrder = 10;

    // Add particle system to scene
    scene.add(sparkParticles);

    // SPARK FUNCTIONS -------------------------------------------------------------------------------------------------

    // Spawn sparks
    function spawnSpark(record, speedMul = 1){

        // Get next available particle slot
        const i = sparks.next;

        // Move to next slot
        sparks.next = (sparks.next + 1) % MAX_SPARKS;

        // Check if slot already in use
        if(sparks.life[i] <= 0){
            sparks.alive++;
        }

        // Scale relative to the reference board
        const scale = Math.min(record.height / 0.72, record.width / 2.1);

        const centre = record.wCenter;
        const widthAxis = record.widthAxis;
        const normal = record.normal;

        // Determine camera angle to sign
        const toCam = tempVec.subVectors(camera.position, centre);
        const normalDir = Math.sign(toCam.dot(normal)) || 1;

        // Random position along the sign's width
        const alongW = (Math.random() - 0.5) * record.width;

        // Randomly choose the top or bottom edge
        const edge = (Math.random() < 0.5 ? 1 : -1) * record.height * 0.5;

        // Spawn slightly in front of the sign
        const out = normalDir * (record.depth * 0.5 + 0.1 * scale);

        // Set particle position
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
        sparks.tint[i] = record.glowColour;

        // Set individual particle size
        sparks.size[i] = Math.min((0.16 + Math.random() * 0.12) * scale, 3);
    }

    // Update all sparks
    function updateSparks(dt){

        // Generate sparks on sign hover
        if(curHoverObj && curHoverObj.isSign && curHoverObj.state.sparks > 0.5){

            // Accumulate sparks
            curHoverObj.spawnAcc += SIGN.sparkRate * dt;

            // Spawn a spark for every accumulated number
            while(curHoverObj.spawnAcc >= 1){

                spawnSpark(curHoverObj);
                curHoverObj.spawnAcc -= 1;
            }
        }

        // Skip particle loop if no active sparks
        if(sparks.alive === 0) return;

        // Update each active particle
        for(let i = 0; i < MAX_SPARKS; i++){

            // Skip inactive particles
            if(sparks.life[i] <= 0) continue;

            // Reduce remaining lifetime
            sparks.life[i] -= dt;

            // Check if particle expired
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

        // Update particle data on GPU
        sparkGeo.attributes.position.needsUpdate = true;
        sparkGeo.attributes.color.needsUpdate = true;
        sparkGeo.attributes.aSize.needsUpdate = true;
    };

    // BUILD RECORDS ---------------------------------------------------------------------------------------------------

    // Build a record for each hoverable object
    function buildRecord(root){

        // Determine whether sign or building
        const sign = isSign(root.name);
        const config = sign ? SIGN : BUILDING;

        // Store materials belonging to object
        const matList = [];
        const matCache = new Map();

        let neonColour = null;

        // Clone materials so shared materials don't light up everywhere
        root.traverse((obj) =>{

            if(!obj.isMesh || isHitBox(obj)) return;

            const matArray = Array.isArray(obj.material);
            const matListForMesh = matArray ? obj.material : [obj.material];

            const clonedMats = matListForMesh.map((mat) =>{

                if(!matCache.has(mat)){

                    const clonedMat = mat.clone();

                    // Use the texture as an emissive map when one isn't assigned
                    if(clonedMat.emissive && clonedMat.map && !clonedMat.emissiveMap && clonedMat.emissive.getHex() === 0){

                        clonedMat.emissiveMap = clonedMat.map;
                        clonedMat.needsUpdate = true;
                    }

                    const hasEmissive = !!clonedMat.emissive;
                    const lit = hasEmissive && clonedMat.emissive.getHex() !== 0;

                    // Find the neon colour
                    if(lit && !neonColour && /neon|glow/i.test(mat.name)){
                        neonColour = clonedMat.emissive.clone();
                    }

                    matCache.set(mat, clonedMat);

                    matList.push({
                        mat: clonedMat,
                        lit,
                        hasEmissive,
                        baseIntensity: hasEmissive ? clonedMat.emissiveIntensity : 1,
                        baseEmissive: hasEmissive ? clonedMat.emissive.clone() : null,
                        baseColour: clonedMat.color ? clonedMat.color.clone() : null
                    });
                }

                return matCache.get(mat);
            });

            obj.material = matArray ? clonedMats : clonedMats[0];
        });

        // Fallback glow colour
        if(!neonColour){

            const lit = matList.find((item) => item.lit);
            neonColour = lit ? lit.baseEmissive.clone() : new THREE.Color(0xffffff);
        }

        const hsl = {};
        neonColour.getHSL(hsl);
        const glowColour = new THREE.Color().setHSL(hsl.h,Math.max(hsl.s, 0.6),Math.max(hsl.l, 0.55));

        // Rest transform + pivot
        const box = getBoundingBox(root);
        const up = findUpAxis(root);

        const pivot = box.getCenter(new THREE.Vector3());

        // Buildings squash from the ground
        if(!sign){
            pivot.setComponent(up, box.min.getComponent(up));
        }

        // SWAY SETUP: the sign swings from the top-centre of its box (like it hangs from something)
        const localSize = box.getSize(new THREE.Vector3());
        const swayPivot = box.getCenter(new THREE.Vector3());
        swayPivot.setComponent(up, box.max.getComponent(up));

        // Of the two horizontal axes, the thinner one points out of the sign's face. Rolling about it
        // makes the sign swing side to side in its own plane (a pendulum).
        const sideAxes = [0, 1, 2].filter((a) => a !== up);
        const faceAxis = localSize.getComponent(sideAxes[0]) < localSize.getComponent(sideAxes[1]) ? sideAxes[0] : sideAxes[1];

        const rollVec = new THREE.Vector3().setComponent(faceAxis, 1);
        const upVec = new THREE.Vector3().setComponent(up, 1);

        // Get world-space bounding box
        const worldBox = getBoundingBox(root, true);

        const worldSize = worldBox.getSize(new THREE.Vector3());
        const worldCentre = worldBox.getCenter(new THREE.Vector3());

        // Sign width runs along whichever horizontal world axis is longer
        const widthAxis = worldSize.x > worldSize.z ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
        const normal = worldSize.x > worldSize.z ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);

        const width = Math.max(worldSize.x, worldSize.z);
        const depth = Math.min(worldSize.x, worldSize.z);

        // Store everything needed for hoverable object
        const record = {

            root,
            isSign: sign,
            config,
            matList,
            glowColour,

            // Original transform
            pos0: root.position.clone(),
            scale0: root.scale.clone(),
            quat0: root.quaternion.clone(),

            // Scaling information
            pivot,
            up,

            // Idle sway
            canSway: sign && canSway(root.name),
            swayPivot,
            rollVec,
            upVec,
            swayPhase: Math.random() * Math.PI * 2,         // random start point so signs don't move in sync
            swaySpeed: 0.8 + Math.random() * 0.4,           // each sign slightly different speed

            // Animation state (sway: 1 = swaying fully, 0 = still, faded out while hovered)
            state: {glow: 0, w: 1, h: 1, sparks: 0, sway: 1},

            // World-space dimensions
            wCenter: worldCentre,
            widthAxis,
            normal,
            width,
            height: worldSize.y,
            depth,

            // Particle spawn accumulator
            spawnAcc: 0,

            // Pinned children
            pinned: [],

            // Halo sprite
            halo: null
        };

        // Store children that should remain in their original position
        root.children.forEach((child) =>{

            if(isStand(child.name)){
                record.pinned.push({obj: child, local0: child.matrix.clone()});
            }
        });

        // Create halo for signs only
        if(sign){

            const halo = new THREE.Sprite(new THREE.SpriteMaterial({
                map: HALO_TEX,
                color: glowColour,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            }));

            halo.scale.set(width * 1.7, worldSize.y * 1.9, 1);
            halo.visible = false;

            scene.add(halo);
            record.halo = halo;
        }

        return record;
    }

    // Call once after the GLB loads: sets up every object with "Hover" in its name
    function setStreet(street){

        street.updateMatrixWorld(true);
        street.traverse((obj) =>{

            if(obj.name.includes(HOVER_TAG) && !hoverObjs.has(obj)){

                const record = buildRecord(obj);
                hoverObjs.set(obj, record);

                // Remember which ones sway
                if(record.canSway) swayRecords.push(record);
            }
        });
    }

    // HOVER IN / OUT --------------------------------------------------------------------------------------------------
    function hoverIn(record, playAudio = true){

        playSound('hover');
        const state = record.state;

        // Stop any previous animations
        gsap.killTweensOf(state);
        activeObjs.add(record);

        // Fade the idle sway out so it doesn't fight the hover animation
        gsap.to(state, {
            sway: 0,
            duration: 0.25,
            ease: 'power2.out'
        });

        // Animate glow
        gsap.timeline()
            .to(state, {
                glow: 1,
                duration: 0.2,
                ease: 'power2.out',
            })
            .to(state, {
                glow: record.isSign ? 0.65 : 0.7,
                duration: 0.7,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1
            });

        // Animate sign
        if(record.isSign){

            gsap.timeline()
                .to(state, {
                    w: 1.2,
                    h: 0.78,
                    duration: 0.1,
                    ease: 'power2.out'
                })
                .to(state, {
                    w: 0.9,
                    h: 1.16,
                    duration: 0.14,
                    ease: 'power2.inOut'
                })
                .to(state, {
                    w: 1.05,
                    h: 1.05,
                    duration: 0.9,
                    ease: 'elastic.out(1,0.35)'
                });

            // Start generating sparks
            state.sparks = 1;

            // Reset accumulator
            record.spawnAcc = 0;

            // Generate initial spark burst
            for(let i = 0; i < SIGN.sparkBurst; i++){
                spawnSpark(record, 1.4);
            }
        }
        else{

            // Animate building
            gsap.timeline()
                .to(state, {
                    w: 1.03,
                    h: 0.97,
                    duration: 0.1,
                    ease: 'power2.out'
                })
                .to(state, {
                    w: 0.99,
                    h: 1.025,
                    duration: 0.14,
                    ease: 'power2.inOut'
                })
                .to(state, {
                    w: 1.012,
                    h: 1.012,
                    duration: 0.8,
                    ease: 'elastic.out(1,0.4)'
                });
        }
    }

    function hoverOut(record){

        const state = record.state;

        // Stop any previous animations
        gsap.killTweensOf(state);

        // Stop generating new sparks
        state.sparks = 0;

        gsap.to(state, {
            glow: 0,
            duration: 0.3,
            ease: 'power2.out'
        });

        // Ease the idle sway back in (slowly, so it drifts back rather than snapping)
        gsap.to(state, {
            sway: 1,
            duration: 1.2,
            ease: 'sine.inOut'
        });

        // Return object to original size
        gsap.to(state, {
            w: 1,
            h: 1,
            duration: 0.35,
            ease: 'power2.out',

            onComplete: () =>{

                applyRecord(record);
                activeObjs.delete(record);
            }
        });
    }

    // Change current hovered object
    function setHoveredRecord(record){

        if(record === curHoverObj) return;

        // Stop previous hover
        if(curHoverObj){
            hoverOut(curHoverObj);
        }

        curHoverObj = record;

        // Start new hover
        if(curHoverObj){
            hoverIn(curHoverObj);
        }
    }

    // Objects without "Hover" are ignored.
    function setHovered(obj){
        setHoveredRecord((obj && hoverObjs.get(obj)) || null);
    }

    // APPLY ANIMATION TO OBJECT --------------------------------------------------------------------------------------
    const scaleVec = new THREE.Vector3();
    const tempColour = new THREE.Color();
    const offset = new THREE.Vector3();

    const matA = new THREE.Matrix4();
    const matB = new THREE.Matrix4();

    function applyRecord(record){

        const state = record.state;
        const glow = state.glow;

        // Apply glow to materials
        for(const item of record.matList){

            if(item.lit){

                item.mat.emissiveIntensity =item.baseIntensity * (1 + glow * record.config.neonBoost);

            } 
            else if(item.hasEmissive){

                // Light the surface with its own colour, nudged toward the sign's neon colour
                item.mat.emissive.copy(item.baseEmissive).add(tempColour.copy(item.baseColour || record.glowColour).multiplyScalar(glow * record.config.faceTint));

                if(!item.mat.emissiveMap){
                    item.mat.emissive.add(tempColour.copy(record.glowColour).multiplyScalar(glow * record.config.faceTint * 0.4));
                }

            } 
            else if(item.baseColour){

                // Unlit (MeshBasicMaterial)
                item.mat.color.copy(item.baseColour).multiplyScalar(1 + glow * record.config.faceTint * 1.5);
            }
        }

        // Update halo
        if(record.halo){

            record.halo.material.opacity = glow * SIGN.halo;
            record.halo.visible = glow > 0.001;

            // Sit just behind the sign relative to the camera
            const back = tempVec.subVectors(record.wCenter, camera.position).normalize();

            record.halo.position.copy(record.wCenter).addScaledVector(back, record.depth * 0.5 + 0.5);
        }

        // IDLE SWAY: work out the small rotation for this moment
        const sway = record.canSway ? state.sway : 0;

        if(sway > 0.001){

            // Two waves at different speeds layered together, so it isn't a perfect metronome
            const t = swayTime * SWAY.speed * record.swaySpeed + record.swayPhase;

            const roll = (Math.sin(t) + 0.4 * Math.sin(t * 2.3 + 1.3)) * SWAY.roll * sway;
            const yaw = Math.sin(t * 0.7 + 2.0) * SWAY.yaw * sway;

            // Combine the two small rotations into one
            swayQuat.setFromAxisAngle(record.rollVec, roll);
            swayQuatB.setFromAxisAngle(record.upVec, yaw);
            swayQuat.multiply(swayQuatB);
        }
        else{
            swayQuat.identity();
        }

        // Original rotation, then the sway on top
        record.root.quaternion.copy(record.quat0).multiply(swayQuat);

        // Squash about the pivot: the local "up" axis gets h, the other two get w
        scaleVec.set(state.w, state.w, state.w).setComponent(record.up, state.h);
        record.root.scale.copy(record.scale0).multiply(scaleVec);

        offset.set(1, 1, 1).sub(scaleVec).multiply(record.pivot).multiply(record.scale0).applyQuaternion(record.quat0);
        record.root.position.copy(record.pos0).add(offset);

        // Rotating moves the sign's top-centre, so shift the sign back so that point stays put (it swings FROM there)
        if(sway > 0.001){

            // Where the sway point sits (scaled) before and after rotating, in the parent's space
            swayVecA.copy(record.swayPivot).multiply(record.root.scale);
            swayVecB.copy(swayVecA).applyQuaternion(record.quat0);
            swayVecA.applyQuaternion(record.root.quaternion);

            record.root.position.add(swayVecB).sub(swayVecA);
        }

        // Pinned children stay where they were in world space
        if(record.pinned.length){

            record.root.updateMatrix();
            matA.compose(record.pos0, record.quat0, record.scale0);

            matB.copy(record.root.matrix).invert().multiply(matA);

            for(const pin of record.pinned){

                pin.obj.matrix.multiplyMatrices(matB, pin.local0);
                pin.obj.matrix.decompose(pin.obj.position, pin.obj.quaternion, pin.obj.scale);
            }
        }
    }

    // UPDATE ---------------------------------------------------------------------------------------------------------
    // Call once per frame. `blocked` = true while dragging / auto-navigating
    function update(blocked = false){

        const now = performance.now();
        const dt = Math.min((now - a_time) / 1000, 0.05);

        a_time = now;

        // Clock for the sway waves
        swayTime += dt;

        // Stop hover while camera is moving
        if(blocked && curHoverObj){
            setHoveredRecord(null);
        }

        // Idle sway: animate signs near the camera (ones in a hover animation are handled below)
        const rangeSq = SWAY.range * SWAY.range;

        for(const record of swayRecords){

            if(activeObjs.has(record)) continue;
            if(record.wCenter.distanceToSquared(camera.position) > rangeSq) continue;

            applyRecord(record);
        }

        // Update active object animations
        for(const record of activeObjs){
            applyRecord(record);
        }

        // Update particles
        updateSparks(dt);
    }

    // Return functions used by main.js
    return {setStreet, setHovered, update,

        get hovered(){
            return curHoverObj ? curHoverObj.root : null;
        }
    };
}