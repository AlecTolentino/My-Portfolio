import * as THREE from 'three';

export const interiors = {

    projects: {
        path: '/world_models/Interiors/arcade_interior.glb',

        camera: {
            position: new THREE.Vector3(4.63, 2.48, 5.86),
            target: new THREE.Vector3(0, 0.5, 0)
        }
    },

    experience: {
        path: '/world_models/Interiors/music_interior.glb',

        camera: {
            position: new THREE.Vector3(-5.28, 2.6, 6.38),
            target: new THREE.Vector3(0.87, 0.13, -1.11)
        }
    },

    skills: {
        path: '/world_models/Interiors/badminton_interior.glb',
        camera: null
    },

    contact: {
        path: '/world_models/Interiors/telephone_interior.glb',
        camera: null
    }

};
