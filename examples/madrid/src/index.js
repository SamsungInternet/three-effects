import { THREE, attachEffects, attach } from "../../../dist/three-effects.js";

import initGround from "./ground.js";
import initSky from "./sky.js";
import initStatues from "./statues.js";
import attachInteract from "./interact.js";

export default function (renderer, scene, camera, assets) {
    //attachRaycast(renderer, scene);
    //renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    var user = new THREE.Group();
    user.add(camera);
    user.add(renderer.vr.getController(0),renderer.vr.getController(1));
    scene.add(user);
    
    var targetPos = new THREE.Vector3();
    scene.addEventListener("teleport", function(e) {
        scene.dispatchEvent({ type: "audio/woosh" });
        targetPos.copy(e.position);
    });

    scene.addEventListener("beforeRender", function(e) {
        user.position.lerp(targetPos,0.05);
    });


    camera.position.y = 1.75;

    var fx = attachEffects(scene);

    window.fx = fx;

    var allFX = {
    //    ssao: true,
    //    outline: false,
        bloom: true,
    //    godrays: true,
    //    colors: false,
    //    "!fxaa": true,
        filmgrain: false,
    //    "!glitch": false,
    }

    attach.bloom(scene, { strength: 0.33, radius: 1, threshold: 0.66 });

    scene.userData.bloom_internal.prePass.onBeforeCompile = function (shader) {
        shader.fragmentShader = shader.fragmentShader.replace("gl_FragColor", "alpha *= smoothstep(1., 0.999, texture2D(depthTexture, vUv).r);\ngl_FragColor");
        console.log(shader);
    }

    attach.filmgrain(scene);

    attachInteract(scene);

    function setupFX() {
        var arr = [];
        for(var k in allFX) {
            if(allFX[k]) arr.push(k);
        }
        fx(arr);
    }

    setupFX();

    scene.addEventListener("tick", function(e) {
        //camera.rotation.y += 0.002;
        scene.userData["filmgrain_time"].value = e.time;
    });

    scene.addEventListener("option", function(e) {
        if(e.name in allFX) {
            allFX[e.name] = e.value;
            setupFX();
        }
    });

    var objects = {
        sky: initSky(renderer, scene, camera, assets),
        ground: initGround(renderer, scene, camera, assets),
        statues: initStatues(renderer, scene, camera, assets)
    }

    Object.values(objects).forEach(function (o) { scene.add(o); });
    
    var listener;

    var firstClick = function () {
        listener = new THREE.AudioListener();
        listener.context.resume();
        camera.add( listener );

        function attachSound(name) {
            var s = new THREE.Audio( listener );
            s.setBuffer(assets[name]);
            s.setVolume( 1.0 );
            scene.addEventListener("audio/" + name, function (){
                s.play();
            });
        }
        
        (["woosh", "tick", "voop", "zit"]).forEach(attachSound);

        window.removeEventListener("click", firstClick);
    }

    window.addEventListener("click", firstClick);
}
