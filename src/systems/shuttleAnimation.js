
export function createShuttleAnimation() {

    const shuttle = document.querySelector('#shuttlecock');
    const trail = document.querySelector('#shuttle-trail');

    if (!shuttle || !trail) return;

    const centreX = 100;
    const centreY = 100;
    const radius = 65;

    const orbitDuration = 1.05; // Seconds per orbit

    const trailCount = 8;
    const trailInterval = 0.1; // Time between ghost appearances
    const trailLifetime = 0.7; // How long each ghost remains visible

    const trailCopies = [];

    // Create reusable ghost copies
    for(let i = 0; i < trailCount; i++){

        const copy = shuttle.cloneNode(true);

        copy.removeAttribute('id');
        copy.removeAttribute('filter');

        copy.style.opacity = '0';
        trail.appendChild(copy);

        trailCopies.push({element: copy, spawnTime: -Infinity, angle: 0});
    }

    let startTime = null;
    let lastTrailTime = 0;
    let nextTrail = 0;

    function positionShuttle(element, angle){

        const x = centreX + Math.cos(angle) * radius;
        const y = centreY + Math.sin(angle) * radius;

        // Rotate so the cork faces the direction of travel
        const rotation = angle * 180 / Math.PI;
        element.setAttribute('transform',`translate(${x} ${y}) rotate(${rotation})`);
    }

    function animate(time){

        if(startTime === null){
            startTime = time;
        }

        const elapsed = (time - startTime) / 1000;
        const angle = (elapsed / orbitDuration) * Math.PI * 2;

        // Move the main shuttlecock
        positionShuttle(shuttle, angle);

        // Create a new ghost periodically
        if(elapsed - lastTrailTime >= trailInterval){

            const ghost = trailCopies[nextTrail];

            ghost.spawnTime = elapsed;
            ghost.angle = angle;

            positionShuttle(ghost.element, ghost.angle);

            lastTrailTime = elapsed;
            nextTrail = (nextTrail + 1) % trailCount;
        }

        // Fade existing ghosts until they disappear
        trailCopies.forEach((ghost, i) => {

            const age = elapsed - ghost.spawnTime;

            if(age < 0 || age >= trailLifetime){

                ghost.element.style.opacity = '0';
                return;
            }

            // Newest ghost is strongest; all fade to nothing
            const fade = 1 - (age / trailLifetime);
            const strength = 0.42 - (i * 0.025);

            ghost.element.style.opacity = Math.max(0, fade * strength);
        });

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}
