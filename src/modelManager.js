export function createModelManager({scene, gltfLoader}){

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

    // Load and display interior
    async function enterInterior(name, path){

        // check if interior already loaded
        if(!cacheInterior.has(name)){

            const gltf = await gltfLoader.loadAsync(path);
            cacheInterior.set(name, gltf.scene);
        }

        const interior = cacheInterior.get(name);

        // Remove street
        if(street){

            scene.remove(street);
        }

        // Display interior
        activeInterior = interior;
        scene.add(activeInterior);

        return activeInterior;
    };

    // Exit interior
    function exitInterior(){

        if(!activeInterior) return;

        scene.remove(activeInterior);
        activeInterior = null;

        // Restore street
        if(street){
            scene.add(street);
        }
    }

    return{setStreet, enterInterior, exitInterior,

        get activeInterior(){
            return activeInterior;
        },

        get isInside(){
            return activeInterior !== null;
        }
    }
};