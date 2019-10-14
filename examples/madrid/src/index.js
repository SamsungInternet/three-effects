import initGround from "./ground.js";
import initSky from "./sky.js";
import initStatues from "./statues.js";
import attachRaycast from "./raycast.js";

export default function (renderer, scene) {
    attachRaycast(renderer, scene);
    initSky(renderer, scene);
    initGround(renderer, scene);
    initStatues(renderer, scene);

    var fx = attachEffects(scene);

    var allFX = {
        ssao: true,
        bloom: true,
        godrays: true,
        outline: false,
        filmgrain: true,
        colors: "",
        "!glitch": false,
        "!fxaa": true
    }

    function setupFX() {
        var arr = [];
        for(var k in allFX) {
            if(allFX[k]) arr.push(k);
        }
        fx(arr);
    }

    scene.addEventListener("option/change", function(e) {
        allFX[e.name] = e.value;
        setupFX();
    });
}