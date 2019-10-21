/* 
* Copyright (c) 2016-2018, Yannis Gravezas 
* Copyright (c) 2019 Samsung Internet
* Available under the MIT license.
*/

import * as THREE from 'three';

export default function (scene, antialias) {
    var renderTargets = [new THREE.WebGLRenderTarget(1, 1), new THREE.WebGLRenderTarget(1, 1)];
    var multiTarget = new THREE.WebGLMultisampleRenderTarget(1, 1);
    multiTarget.samples = antialias === true ? 4 : antialias;
    var depthTexture = new THREE.DepthTexture();
    depthTexture.format = THREE.DepthStencilFormat;
    depthTexture.type = THREE.UnsignedInt248Type;

    renderTargets[0].depthTexture = multiTarget.depthTexture = depthTexture;
    
    scene.userData.VR = { value: 0 };
    scene.userData.colorTexture = { value: null };
    scene.userData.depthTexture = { value: depthTexture };
    
    var passes = [];
    
    var realTarget;

    var _scene = new THREE.Scene();
    var _ortho = new THREE.OrthographicCamera(1,1,1,1,1,10);
    var _quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2,2), null);
    _quad.frustumCulled = false;
    _scene.add(_quad);

    var vsize = new THREE.Vector2();

    scene.userData.resolution = { value: vsize };

    var event = { type: "beforeRender", scene: null, renderer: null, camera: null, size: vsize };
    
    function dispatch(type) {
        event.type = type;
        scene.dispatchEvent(event);
    }

    scene.onBeforeRender = function (renderer, scene, camera, renderTarget) {
        if (!passes.length) return;

        if (renderTarget) {
            vsize.set(renderTarget.width, renderTarget.height);
        } else {
            renderer.getDrawingBufferSize(vsize);
        }

        if(vsize.x !== renderTargets[0].width || vsize.y !== renderTargets[0].height) {
            renderTargets[0].setSize(vsize.x, vsize.y);
            renderTargets[1].setSize(vsize.x, vsize.y);
            multiTarget.setSize(vsize.x, vsize.y);
            dispatch("resizeEffects");
        }

        scene.userData.VR.value = renderer.vr.isPresenting() ? vsize.x * 0.5 : 0;
    
        event.renderer = renderer;
        event.scene = scene;
        event.camera = camera;
        realTarget = event.outputTarget = renderTarget;
        event.renderTarget = renderTargets[0];
        dispatch("beforeRender");

        renderer.setRenderTarget(antialias && renderer.capabilities.isWebGL2 ? multiTarget : renderTargets[0]);
    };

    scene.onAfterRender = function (renderer, scene, camera) {
        if (!passes.length) return;

        var vrEnabled = renderer.vr.enabled;
        renderer.vr.enabled = false;
        
        var u = scene.userData;
        event.renderTarget = antialias && renderer.capabilities.isWebGL2 ? multiTarget : renderTargets[0];
        u.colorTexture.value = event.renderTarget.texture;
       
        dispatch("afterRender");
        
        passes.forEach(function (p, i) {
            event.passId = p.passId;
            dispatch("beforePass");
        
            var rt = (i == (passes.length - 1)) ? realTarget : renderTargets[(i + 1) & 1];
        
            _quad.material = p;
            renderer.setRenderTarget(rt);
            //renderer.setViewport(0, 0, vsize.x, vsize.y);
            renderer.render(_scene, _ortho);
        
            u.colorTexture.value = rt ? rt.texture : null;
            event.renderTarget = rt;
            dispatch("afterPass");
        });

        delete event.passId;
        dispatch("afterEffects");
        renderer.vr.enabled = vrEnabled;
    };

    var fxPattern = /FX_PASS_[0-9]+/gm;
    var symPattern = /^\w+$/;
    var uPattern = /^\s*uniform\s+/;

    function parsePasses( src ) {
        var arr = src.match(fxPattern);
        if(!arr) return ["main"];
        var set = new Set(arr);
        arr = [...set];
        arr.sort(function(a, b) {
            return a.localeCompare(b);
        });
        arr.push("main");
        return arr;
    }

    return function ( src ) {       
        passes.forEach(function(m){ m.dispose(); });
        passes = [];

        if(!src) return;

        if (Array.isArray(src)) {
            var head = [];
            var body = [];
            var bc = 0, c = 0;
            
            src.forEach(function (s, i) {
                if(i && s[0] === "!") bc++;
            });

            if(bc) body.push(`#if defined FX_PASS_${c}`);
            
            src.forEach(function (s, i) {
                
                if(bc && i && s[0] === "!") {
                    body.push(c < bc - 1 ? `#elif defined FX_PASS_${++c}` : "#else");    
                }
                
                s = s.replace("!", "").trim();

                if(!s) return;

                if(s[0] = "#") {
                    head.push(`#include <${s.replace("#", "")}>`);
                } else if(s.match(symPattern)) {    
                    head.push(`#include <${s}_pars>`);
                    body.push(`\t${s}_apply(color, uv);`)
                } else if(s.match(uPattern)){
                    head.push(s);
                } else {
                    body.push(s);
                }

            });
            
            //body.push("fragColor.a = 1.0;")
            if(bc) body.push("#endif");

            src = [
                head.join("\n"),
                "",
                "void main(void){",
                "\tvec2 uv = vUv;",
                "\tvec4 color = texture2D(colorTexture, uv);",
                body.join("\n"),
                "\tgl_FragColor = color;",
                "}"
            ].join("\n")
        }

        var def = parsePasses(src);

        src = [
            "#include <common>",
            "uniform sampler2D colorTexture;",
            "uniform sampler2D depthTexture;",
            "uniform vec2 resolution;",
            "varying vec2 vUv;",
            src
        ].join("\n");

        def.forEach(function (d){
            var defines = {};
            if(d !== "main") defines[d] = 1;
            var m = new THREE.ShaderMaterial({
                defines: defines,
                uniforms: scene.userData,
                vertexShader: `
                    varying vec2 vUv;
    
                    void main(void) {
                        vUv = uv;
                        gl_Position = vec4(position.xy, 0., 1.);
                    }
                `,
                fragmentShader: src,
                depthWrite: false,
                depthTest: false,
                extensions: {
                    derivatives: true,
                    shaderTextureLOD: true
                },
                fog: false,
                lights: false
            });
            m.passId = d;
            passes.push(m);
        });
    }
}