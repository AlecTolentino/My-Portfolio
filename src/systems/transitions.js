import gsap from 'gsap';

export function createTransitions({duration = 0.6} = {}){

    let isTransitioning = false;

    // Create black screen overlay
    const overlay = document.createElement('div');

    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'black';
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '9999';
    overlay.style.willChange = 'opacity';

    document.body.appendChild(overlay);

    // Animate overlay opacity
    function animateOpacity(opacity){
        return new Promise(resolve => {
            gsap.to(overlay, {opacity, duration, ease: 'power2.inOut', onComplete: resolve});
        });
    };

    // Fade to black
    async function fadeToBlack(){

        overlay.style.pointerEvents = 'auto';
        await animateOpacity(1);
    };

    // Fade back in
    async function fadeFromBlack(){

        await animateOpacity(0);
        overlay.style.pointerEvents = 'none';
    };

    // Operation between fade
    async function run(callback){

        if(isTransitioning) return false;
        isTransitioning = true;

        try{

            // Hide current scene
            await fadeToBlack();

            // Perform operation while black screen
            await callback();

            // Load new scene
            await fadeFromBlack();

            return true;
        }
        catch(error){

            // Restore visibility
            await fadeFromBlack();
            throw error;
        }
        finally{
            isTransitioning = false;
        }
    };

    return{fadeToBlack, fadeFromBlack, run,
        get isTransitioning(){
            return isTransitioning;
        }
    };
};