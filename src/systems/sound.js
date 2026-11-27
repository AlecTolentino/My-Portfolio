const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContextClass();

const soundFiles = {
    hover: '/Assets/Audio/hover.mp3',
    zoom: '/Assets/Audio/whoosh.mp3',
    click: '/Assets/Audio/click.mp3'
};

const buffers = {};
let hoverSoundEnabled = true;

// Load and decode all sounds immediately
const loadPromises = Object.entries(soundFiles).map(async ([name, path]) => {
    try{
        const response = await fetch(path);
        if(!response.ok) throw new Error(`Failed to load ${path}`);

        const data = await response.arrayBuffer();
        buffers[name] = await audioContext.decodeAudioData(data);
    }
    catch(error){
        console.error(`Audio loading error (${name}):`, error);
    }
});

// Unlock audio during a user interaction
export function unlockAudio(){
    if(audioContext.state === 'suspended'){
        return audioContext.resume();
    }

    return Promise.resolve();
};

// Play decoded sound
function playBuffer(name){

    const buffer = buffers[name];
    if(!buffer) return;

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
}

// Play sound
export function playSound(name){
    if(name === 'hover' && !hoverSoundEnabled) return;

    // Sound not found
    if(!soundFiles[name]) {
        console.warn(`Sound not found: ${name}`);
        return;
    }

    // Wait for decoding if necessary
    if(!buffers[name]){const promise = loadPromises.find(
        
        (_, index) =>Object.keys(soundFiles)[index] === name);

        promise?.then(() => {if(audioContext.state === 'running') playBuffer(name);});
        return;
    }

    if(audioContext.state === 'suspended') {
        audioContext.resume().then(() => playBuffer(name)).catch(() => {});
        return;
    }

    playBuffer(name);
};

// Setter
export function setHoverSound(enabled){
    hoverSoundEnabled = enabled;
};
