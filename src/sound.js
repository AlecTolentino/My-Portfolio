const sounds = {

    hover: new Audio('/Assets/Audio/hover.mp3'),
    zoom: new Audio('/Assets/Audio/whoosh.mp3'),
    click: new Audio('/Assets/Audio/click.mp3')
};


// Set when hover is played
let hoverSoundEnabled = true;

export function playSound(name){

    if(name === 'hover' && !hoverSoundEnabled) return;

    const sound = sounds[name];

    if(!sound){

        console.warn(`Sound not found: ${name}`);
        return;
    }

    // Don't restart hover sound if it's already playing
   // if(name === 'hover' && !sound.paused) return;

    sound.currentTime = 0;
    sound.play().catch(() => {});
};

// Enable / disable hover sounds
export function setHoverSound(enabled){
    hoverSoundEnabled = enabled;
}
