/* 
* Copyright (c) 2016-2018, Yannis Gravezas 
* Copyright (c) 2019 Samsung Internet
* Available under the MIT license.
*/

import * as THREE from 'three';

THREE.ShaderChunk["vr_pars"] = `
    uniform float VR;

    #define selectVR(novr, left, right) ( (VR > 0.) ? ( (gl_FragCoord.x < VR) ? (left) : (right) ): (novr))

    vec4 textureVR(in sampler2D tex, in vec2 uv) {
        uv.x = selectVR(uv.x, min(0.5, uv.x), max(0.5, uv.x) );
        return texture2D(tex, uv);
    }

    vec4 textureVR(in sampler2D tex, in vec2 uv, float bias) {
        uv.x = selectVR(uv.x, min(0.5, uv.x), max(0.5, uv.x));
        return texture2D(tex, uv, bias);
    }

    #ifdef TEXTURE_LOD_EXT

    vec4 textureVRLod(in sampler2D tex, in vec2 uv, float lod) {
        uv.x = selectVR(uv.x, min(0.5, uv.x), max(0.5, uv.x));
        return texture2DLodEXT(tex, uv, bias);
    }

    #endif
`;

export default function (scene) {
    var renderTargets = [new THREE.WebGLRenderTarget(1, 1), new THREE.WebGLRenderTarget(1, 1)];
    var depthTexture = new THREE.DepthTexture();
    depthTexture.format = THREE.DepthStencilFormat;
    depthTexture.type = THREE.UnsignedInt248Type;

    window.depthTexture = depthTexture;

    renderTargets[0].depthTexture = depthTexture;
    
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
            
            dispatch("resizeEffects");
        }

        scene.userData.VR.value = renderer.vr.isPresenting() ? vsize.x * 0.5 : 0;
    
        event.renderer = renderer;
        event.scene = scene;
        event.camera = camera;
        realTarget = event.outputTarget = renderTarget;
        event.renderTarget = renderTargets[0];
        dispatch("beforeRender");

        renderer.setRenderTarget(renderTargets[0]);
    };

    scene.onAfterRender = function (renderer, scene, camera) {
        if (!passes.length) return;

        var vrEnabled = renderer.vr.enabled;
        renderer.vr.enabled = false;
        
        var u = scene.userData;
    
        u.colorTexture.value = renderTargets[0].texture;
       
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

    function parsePasses( src ) {
        var pattern = /FX_PASS_[0-9]+/gm;
        var arr = src.match(pattern);
        if(!arr) return [""];
        var set = new Set(arr);
        arr = [...set];
        arr.sort(function(a, b) {
            return a.localeCompare(b);
        });
        arr.push("");
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
                s = s.replace("!", "");
                head.push(`#include <${s}_pars>`);
                body.push(`\t${s}_apply(fragColor, vUv);`)
            });
            
            if(bc) body.push("#endif");

            src = [
                head.join("\n"),
                "",
                "void main(void){",
                "\tvec4 fragColor = texture2D(colorTexture, vUv);",
                body.join("\n"),
                "\tgl_FragColor = fragColor;",
                "}"
            ].join("\n")
        }

        var def = parsePasses(src);

        src = [
            "uniform sampler2D colorTexture;",
            "uniform sampler2D depthTexture;",
            "uniform vec2 resolution;",
            "varying vec2 vUv;",
            src
        ].join("\n");

        def.forEach(function (d){
            var defines = {};
            if(d) defines[d] = 1;
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