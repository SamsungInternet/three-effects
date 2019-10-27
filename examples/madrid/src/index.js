import { THREE, attachEffects, attach } from "../../../dist/three-effects.js";

import initGround from "./ground.js";
import initSky from "./sky.js";
import initStatues from "./statues.js";
import attachInteract from "./interact.js";
import attachLabel from "./label.js";

export default function (renderer, scene, camera, assets) {
    
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    var user = new THREE.Group();
    user.add(camera);
    user.add(renderer.vr.getController(0),renderer.vr.getController(1));
    scene.add(user);
    
    var targetPos = new THREE.Vector3();
    var origPos = new THREE.Vector3();

    var teleportTime = 0;

    scene.addEventListener("teleport", function(e) {
        scene.dispatchEvent({ type: "audio/woosh" });
        origPos.copy(user.position);
        targetPos.copy(e.position);
        teleportTime = window.performance.now();
    });

    scene.addEventListener("beforeRender", function(e) {
        user.position.copy(origPos);
        user.position.lerp( targetPos, 1 - Math.pow( 1 - Math.min(1, (e.time - teleportTime) / 900 ), 6) );
    });


    camera.position.y = 1.75;

    var fx = attachEffects(scene);

    window.fx = fx;

    var allFX = {
    //    ssao: true,
    //    outline: false,
    //    godrays: true,
    //    colors: false,
        "!fxaa": false,
        bloom: false,
        "!glitch": false,
        filmgrain: false
    }

    attach.bloom(scene, { strength: 0.33, radius: 1, threshold: 0.5 });
    attach.glitch(scene, { snow:0.2 });

    scene.userData.glitch_intensity.value = 0.8;
    window.scene = scene;
    scene.userData.bloom_internal.prePass.onBeforeCompile = function (shader) {
        shader.fragmentShader = shader.fragmentShader.replace("gl_FragColor", "alpha *= smoothstep(1., 0.999, texture2D(depthTexture, vUv).r);\ngl_FragColor");
    }

    attach.filmgrain(scene);

    attachLabel(scene, assets);
    
    attachInteract(scene, {debug: true});

    
    function setupFX() {
        var arr = [];
        for(var k in allFX) {
            if(allFX[k]) arr.push(k);
        }
        fx(arr);
    }

    setupFX();

    //fx(null);

    scene.addEventListener("beforeRender", function(e) {
        scene.userData["filmgrain_time"].value = e.time / 1000;
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
                if(s.isPlaying) {
                    var s2 = new THREE.Audio( listener );
                    s2.setBuffer(assets[name]);
                    s2.setVolume( 1.0 );
                    s2.play();        
                } else {
                    s.play();
                }
            });
        }
        
        (["woosh", "tick", "voop", "zit"]).forEach(attachSound);

        window.removeEventListener("click", firstClick);
    }

    window.addEventListener("click", firstClick);
}
