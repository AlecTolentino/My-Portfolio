export function createModelManager({scene, camera}){

    let street = null;
    let activeInterior = null;

    // Load interiors into memory
    const cacheInterior = new Map();

    // Store street model
    function setStreet(model){

        street = model;
        if(!scene.children.includes(street)){
            scene.add(street);
        }
    }









}