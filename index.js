/* 
* Copyright (c) 2016-2019, Yannis Gravezas Available under the MIT license.
*/

var THREE = require('three');
window.THREE = THREE;

window.attachEffects = module.exports = function (scene) {
    var renderTargets = [new THREE.WebGLRenderTarget(1, 1), new THREE.WebGLRenderTarget(1, 1)];
    renderTargets[0].depthTexture = new THREE.DepthTexture();

    renderTargets[0].depthTexture.type = THREE.UnsignedInt248Type;

    scene.userData.colorTexture = { value: null };
    scene.userData.depthTexture = { value: null };
    
    var passes = [];
    var realTarget = null;

    var _scene = new THREE.Scene();
    var _ortho = new THREE.OrthographicCamera(1,1,1,1,1,10);
    var _geo = new THREE.PlaneBufferGeometry(2,2);
    var _quad = new THREE.Mesh(_geo, null);
    _quad.frustumCulled = false;
    _scene.add(_quad);

    var vsize = new THREE.Vector2();

    var beforeEvent = { type: "beforeRender", scene: null, renderer: null, camera: null, size: vsize };
    var afterEvent = { type: "afterRender", scene: null, renderer: null, camera: null, size: vsize };
    
    function patchEvent(ev, renderer, scene, camera, realTarget, renderTarget) {
        ev.renderer = renderer;
        ev.scene = scene;
        ev.camera = camera;
        ev.realTarget = realTarget;
        ev.renderTarget = renderTarget;
    }

    scene.onBeforeRender = function (renderer, scene, camera, renderTarget) {
        if (!passes.length) return;

        if(renderTarget) {
            vsize.set(renderTarget.width, renderTarget.height);
        } else {
            renderer.getDrawingBufferSize(vsize);
        }
    
        beforeEvent.size = null;
    
        if(vsize.x !== renderTargets[0].width || vsize.y !== renderTargets[0].height) {
            renderTargets[0].setSize(vsize.x, vsize.y);
            renderTargets[1].setSize(vsize.x, vsize.y);
        }

        patchEvent(beforeEvent, renderer, scene, camera, renderTarget, renderTargets[0]);
        
        realTarget = renderTarget;
        
        renderer.setRenderTarget(renderTargets[0]);
        
        scene.dispatchEvent(beforeEvent);
    };

    scene.onAfterRender = function (renderer, scene, camera) {
        if (!passes.length) return;

        patchEvent(afterEvent, renderer, scene, camera, realTarget, renderTargets[0]);
       
        var u = scene.userData;
    
        u.colorTexture.value = renderTargets[0].texture;
        u.depthTexture.value = renderTargets[0].depthTexture;

        scene.dispatchEvent(afterEvent);

        passes.forEach(function (p, i) {
            u.colorTexture.value = renderTargets[i & 1].texture;
            renderer.setRenderTarget(i === (passes.length - 1) ? realTarget : renderTargets[(i + 1) & 1]);
            _quad.material = p;
            renderer.render(_scene, _ortho);
        });
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

        var def = parsePasses(src);

        src = [
            "uniform sampler2D colorTexture;",
            "uniform sampler2D depthTexture;",
            "varying vec2 vUv;",
            src
        ].join("\n");

        def.forEach(function (d){
            var defines = {};
            if(d) defines[d] = 1;
            passes.push( new THREE.ShaderMaterial({
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
            }));
        });
    }
}