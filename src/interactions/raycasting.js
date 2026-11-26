import * as THREE from 'three';

export function createRaycasting({camera, canvas}){

    // Raycast vars
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector3();
    const  rayCastObjects = [];

    // Detect mouse hover on interactables
    function detectHover(e){

        const rect = canvas.getBoundingClientRect();

        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const hits = raycaster.intersectObjects(rayCastObjects, true);

        if(!hits.length) return null;

        return hits[0].object.userData.target || null;
    };

    // Detect raycast objects from model
    function registerModel(model){

        // Clear objects of previous model
        rayCastObjects.length = 0;

        model.traverse((child) => {
            
            if(child.name.includes("Raycaster")){
                rayCastObjects.push(child);

                child.traverse((part) => {
                    part.userData.target = child;
                });
            }
        });
    };

    return{detectHover, registerModel};
};