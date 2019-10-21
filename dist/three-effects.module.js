import { WebGLRenderTarget, ShaderMaterial, Vector2, Scene, OrthographicCamera, Mesh, PlaneBufferGeometry, ShaderChunk, WebGLMultisampleRenderTarget, DepthTexture, DepthStencilFormat, UnsignedInt248Type } from 'three';
import * as THREE from 'three';
export { THREE };

ShaderChunk["bloom_pars"] = `
    uniform sampler2D bloom_texture;

    void bloom_apply(inout vec4 fragColor, in vec2 uv) {
        fragColor.rgb += texture2D(bloom_texture, uv).rgb;
    }
`;

function index (scene, config) {

    config = config || {};

    var inp = new WebGLRenderTarget(1,1);
    var ping = [ new WebGLRenderTarget(1,1), new WebGLRenderTarget(1,1), new WebGLRenderTarget(1,1) ];
    var pong = [ new WebGLRenderTarget(1,1), new WebGLRenderTarget(1,1), new WebGLRenderTarget(1,1) ];
    
    var passId = config.before || "main";

    function getPass(src, uniforms) {
        return new ShaderMaterial({
            uniforms: uniforms,
            vertexShader: `
                varying vec2 vUv;

                void main(void) {
                    vUv = uv;
                    gl_Position = vec4(position.xy, 0., 1.);
                }
            `,
            fragmentShader: "varying vec2 vUv;\n" + src,
            depthWrite: false,
            depthTest: false
        });
    }

    var controlUniforms = {};

    var preUniforms = config.inputUniforms || {
        colorTexture: { value: null },
        depthTexture: { value: null },
        threshold: { value: config.threshold || 0.9 },
        smooth: { value: config.smooth || 0.01 }
    };

    var prePass = getPass(config.inputShader || `
        uniform sampler2D colorTexture;
        uniform sampler2D depthTexture;
        uniform float threshold;

        void main(void) {
            vec4 texel = texture2D( colorTexture, vUv );
			vec3 luma = vec3( 0.299, 0.587, 0.114 );
			float v = dot( texel.xyz, luma );
			vec4 outputColor = vec4( 0., 0., 0., 1. );
            float alpha = smoothstep( threshold, threshold + 0.01, v );
            
			gl_FragColor = mix( outputColor, texel, alpha );
        }
    `, preUniforms);
    
    var blurUniforms = {
        colorTexture: { value: null },
        direction: { value: new Vector2(1, 0) },
        resolution: { value: new Vector2(1, 1) }
    };
    
    var blurPasses = [
        getPass(`
            #include <vr_pars>
            #include <blur_pars>
            
            uniform sampler2D colorTexture;
            uniform vec2 direction;
            uniform vec2 resolution;
            
            void main(void) {
                gl_FragColor = blur5(colorTexture, vUv, direction, resolution); 
            }
        `, blurUniforms),
        getPass(`
            #include <vr_pars>
            #include <blur_pars>
            
            uniform sampler2D colorTexture;
            uniform vec2 direction;
            uniform vec2 resolution;
            
            void main(void) {
                gl_FragColor = blur9(colorTexture, vUv, direction, resolution); 
            }
        `, blurUniforms),
        getPass(`
            #include <vr_pars>
            #include <blur_pars>
            
            uniform sampler2D colorTexture;
            uniform vec2 direction;
            uniform vec2 resolution;
            
            void main(void) {
                gl_FragColor = blur13(colorTexture, vUv, direction, resolution); 
            }
        `, blurUniforms),
    ];

    var postUniforms = {
        strength: { value: 0.5 },
        radius: { value: 1 },
        blurTexture1: { value: pong[0].texture },
        blurTexture2: { value: pong[1].texture },
        blurTexture3: { value: pong[2].texture },
        colorTexture: { value: null }
	};

    controlUniforms.strength = scene.userData.bloom_strength = postUniforms.strength;
    controlUniforms.radius = scene.userData.bloom_radius = postUniforms.radius;
    if (preUniforms.threshold) controlUniforms.threshold = scene.userData.bloom_threshold = preUniforms.threshold;
    scene.userData.bloom_texture = { value: ping[0].texture };

    var postPass = getPass(`
        uniform sampler2D blurTexture1;
        uniform sampler2D blurTexture2;
        uniform sampler2D blurTexture3;
        uniform float strength;
        uniform float radius;
        
        float lerpBloomFactor(const in float factor, const in float mirrorFactor) {
            return mix(factor, mirrorFactor, radius);
        }

        void main() {
            gl_FragColor = strength * ( lerpBloomFactor(1., 0.1) *  texture2D(blurTexture1, vUv) + \
                                            lerpBloomFactor(0.25, 0.75) *  texture2D(blurTexture2, vUv) + \
                                            lerpBloomFactor(0.1, 1.) *  texture2D(blurTexture3, vUv) );\
        }
    `, postUniforms);

    scene.userData.bloom_internal = {prePass, blurPasses, postPass};

    var _scene = new Scene();
    var _ortho = new OrthographicCamera(1,1,1,1,1,10);
    var _quad = new Mesh(new PlaneBufferGeometry(2,2), null);
    _quad.frustumCulled = false;
    _scene.add(_quad);

    function performPass(renderer, m, inputTarget, outputTarget) {
        _quad.material = m;
        if (m.uniforms.colorTexture)
            m.uniforms.colorTexture.value = inputTarget ? inputTarget.texture : null;
        if (m.uniforms.depthTexture)
            m.uniforms.depthTexture.value = inputTarget ? inputTarget.depthTexture: null;
        if (m.uniforms.resolution) 
            m.uniforms.resolution.value.set(outputTarget.width, outputTarget.height);
        renderer.setRenderTarget(outputTarget);
        renderer.render(_scene, _ortho);
    }

    var fn = function (e) {
        if(passId !== e.passId) return;
        
        blurUniforms.VR = { value: 0 };
        
        performPass(e.renderer, prePass, e.renderTarget, inp);

        blurUniforms.VR.value = e.scene.userData.VR.value * 0.25;
        
        for(var i=0; i< 3; i++) {
            blurUniforms.direction.value.set(0, 1);
            performPass(e.renderer, blurPasses[i], i ? pong[i - 1] : inp, ping[i]);
            
            blurUniforms.direction.value.set(1, 0);
            performPass(e.renderer, blurPasses[i], ping[i], pong[i]);
            blurUniforms.VR.value *= 0.5;
        }

        performPass(e.renderer, postPass, false, ping[0]);
    };

    scene.addEventListener("beforePass", fn);

    var fr = function (e) {
        var w = e.size.x * 0.5, h = e.size.y * 0.5;
        inp.setSize(w, h);
        for(var i=0; i< 3; i++) {
            w = Math.floor(w * 0.5);
            h = Math.floor(h * 0.5);
            ping[i].setSize(w, h);
            pong[i].setSize(w, h);
        }
    };

    scene.addEventListener("resizeEffects", fr);

    return function (arg) {
        if ( arg ) {
            if(arg.before) passId = arg.before;
            for ( var k in arg) {
                if (controlUniforms[k]) {
                    controlUniforms[k].value = arg[k];
                }
            }
        } else {
            scene.removeEventListener("beforePass", fn);
            scene.removeEventListener("resizeEffects", fr);
            
            inp.dispose();
            for(var i = 0; i < 3; i++) {
                ping[i].dispose();
                pong[i].dispose();
                blurPasses[i].dispose();
            }

            prePass.dispose();
            postPass.dispose();

            delete scene.userData.bloom_internal;
            delete scene.userData.bloom_strength;
            delete scene.userData.bloom_radius;
            delete scene.userData.bloom_threshold;
            delete scene.userData.bloom_texture;
        }
    }
}

ShaderChunk["fxaa_pars"] = `
    #define FXAA_REDUCE_MIN   (1.0/ 128.0)
    #define FXAA_REDUCE_MUL   (1.0 / 8.0)
    #define FXAA_SPAN_MAX     8.0

    void fxaa_apply(inout vec4 color, in vec2 uv)
    {
        vec2 inverseVP = vec2(1.0 / resolution.x, 1.0 / resolution.y);
        vec3 rgbNW = texture2D(colorTexture, uv + vec2(-1.0, -1.0) * inverseVP).xyz;
        vec3 rgbNE = texture2D(colorTexture, uv + vec2(1.0, -1.0) * inverseVP).xyz;
        vec3 rgbSW = texture2D(colorTexture, uv + vec2(-1.0, 1.0) * inverseVP).xyz;
        vec3 rgbSE = texture2D(colorTexture, uv + vec2(1.0, 1.0) * inverseVP).xyz;
        vec3 rgbM  = color.rgb;
        vec3 luma = vec3(0.299, 0.587, 0.114);
        float lumaNW = dot(rgbNW, luma);
        float lumaNE = dot(rgbNE, luma);
        float lumaSW = dot(rgbSW, luma);
        float lumaSE = dot(rgbSE, luma);
        float lumaM  = dot(rgbM,  luma);
        float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
        float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));
        
        vec2 dir;
        dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
        dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));
        
        float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) *
                            (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);
        
        float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
        dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX),
                max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX),
                dir * rcpDirMin)) * inverseVP;
        
        vec3 rgbA = 0.5 * (
            texture2D(colorTexture, uv  + dir * (1.0 / 3.0 - 0.5)).xyz +
            texture2D(colorTexture, uv + dir * (2.0 / 3.0 - 0.5)).xyz);
        vec3 rgbB = rgbA * 0.5 + 0.25 * (
            texture2D(colorTexture, uv + dir * -0.5).xyz +
            texture2D(colorTexture, uv + dir * 0.5).xyz);
            
        float lumaB = dot(rgbB, luma);
        if ((lumaB < lumaMin) || (lumaB > lumaMax))
            color.rgb = rgbA;
        else
            color.rgb = rgbB;
    }

`;
// FXAA doesn't do any texture generation or need uniforms but we stay consistent with the other effects
function index$1(){
    return function () {}
}

ShaderChunk["filmgrain_pars"] = `
    uniform float filmgrain_time;
    uniform float filmgrain_sCount;
    uniform float filmgrain_sIntensity;
    uniform float filmgrain_nIntensity;
    
    void filmgrain_apply(inout vec4 color, in vec2 uv) {
           vec4 cTextureScreen = color;
		   float dx = rand( uv + mod(filmgrain_time, 3.14) );
		   vec3 cResult = cTextureScreen.rgb + cTextureScreen.rgb * clamp( 0.1 + dx, 0.0, 1.0 );
		   vec2 sc = vec2( sin( uv.y * filmgrain_sCount ), cos( uv.y * filmgrain_sCount ) );
		   cResult += cTextureScreen.rgb * vec3( sc.x, sc.y, sc.x ) * filmgrain_sIntensity;
           cResult = cTextureScreen.rgb + clamp( filmgrain_nIntensity, 0.0,1.0 ) * ( cResult - cTextureScreen.rgb );
		   color.rgb =  cResult;
	}
`;

function index$2 (scene, config) {

    var controlUniforms = {
        "time":       { type: "f", value: 0.0 },
        "nIntensity": { type: "f", value: 0.3 },
        "sIntensity": { type: "f", value: 0.03 },
        "sCount":     { type: "f", value: 4096 }
    };

    function handleConf(conf) {
        for(var k in conf) {
            if(k in controlUniforms){
                controlUniforms[k].value = conf[k];
            }
        }
    }

    if(config) handleConf(config);

    scene.userData["filmgrain_time"] = controlUniforms["time"];
    scene.userData["filmgrain_sCount"] = controlUniforms["sCount"];
    scene.userData["filmgrain_sIntensity"] = controlUniforms["sIntensity"];
    scene.userData["filmgrain_nIntensity"] = controlUniforms["nIntensity"];
    
    return function (arg) {
        if(arg) {
            handleConf(arg);
            return;
        }
        delete scene.userData["filmgrain_time"];
        delete scene.userData["filmgrain_sCount"];
        delete scene.userData["filmgrain_sIntensity"];
        delete scene.userData["filmgrain_nIntensity"];
    }

}

//export { bloom, fxaa, filmgrain, colors, glitch }

var index$3 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    bloom: index,
    fxaa: index$1,
    filmgrain: index$2
});

/* 
* Copyright (c) 2016-2018, Yannis Gravezas 
* Copyright (c) 2019 Samsung Internet
* Available under the MIT license.
*/

function fx (scene, antialias) {
    var renderTargets = [new WebGLRenderTarget(1, 1), new WebGLRenderTarget(1, 1)];
    var multiTarget = new WebGLMultisampleRenderTarget(1, 1);
    multiTarget.samples = antialias === true ? 4 : antialias;
    var depthTexture = new DepthTexture();
    depthTexture.format = DepthStencilFormat;
    depthTexture.type = UnsignedInt248Type;

    renderTargets[0].depthTexture = multiTarget.depthTexture = depthTexture;
    
    scene.userData.VR = { value: 0 };
    scene.userData.colorTexture = { value: null };
    scene.userData.depthTexture = { value: depthTexture };
    
    var passes = [];
    
    var realTarget;

    var _scene = new Scene();
    var _ortho = new OrthographicCamera(1,1,1,1,1,10);
    var _quad = new Mesh(new PlaneBufferGeometry(2,2), null);
    _quad.frustumCulled = false;
    _scene.add(_quad);

    var vsize = new Vector2();

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

    function parsePasses( src ) {
        var pattern = /FX_PASS_[0-9]+/gm;
        var arr = src.match(pattern);
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
                s = s.replace("!", "");
                head.push(`#include <${s}_pars>`);
                body.push(`\t${s}_apply(fragColor, vUv);`);
            });
            
            body.push("fragColor.a = 1.0;");
            if(bc) body.push("#endif");

            src = [
                head.join("\n"),
                "",
                "void main(void){",
                "\tvec4 fragColor = texture2D(colorTexture, vUv);",
                body.join("\n"),
                "\tgl_FragColor = fragColor;",
                "}"
            ].join("\n");
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
            var m = new ShaderMaterial({
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

/* 
* Copyright (c) 2016-2018, Yannis Gravezas 
* Copyright (c) 2019 Samsung Internet
* Available under the MIT license.
*/

function ecs (obj, name, api) {
  
    var objects = [];

    var listeners = {};

    function addListener(lname, fn) {
        listeners[lname] = fn;
        obj.addEventListener(lname, listeners[lname]);
    }

    addListener(name + "/register", function(e) {
        var index = objects.indexOf(e.entity);
        if( index !== -1) {
            objects.splice(index, 1);
            if(api.remove) api.remove(e, objects, name);
            delete e.entity.userdata[name];
        }
        objects.push(e.entity);
        e.entity.userData[name] = api.init(e, objects, name, e.reset);
    });

    addListener(name + "/unregister", function(e) {
        var index = objects.indexOf(e.entity);
        if(index !== -1) {
            objects.splice(index, 1);
            if(api.remove) api.remove(e, objects, name);
            delete e.entity.userData[name];
        }
    });

    for (var k in api) {
        switch(k) {
            case "init": 
            case "remove": 
            case "control": continue;
            default:
                addListener(k, function(e) {
                    api[k](e, objects, name);
                });
                break;
        }
    }

    return function (arg) {
        if(!arg) {
            objects.forEach( function (obj) {
                if (api.remove) api.remove({ entity: obj }, objects, name);
                delete e.entity.userdata[name];
            });
            for(var k in listeners) {
                obj.removeEventListener(k, listeners[k]);
            }
        } else if (api.control) {
            api.control(arg, objects, name);
        }
    }
}

ShaderChunk["vr_pars"] = `
    #ifndef VR_PARS

    #define VR_PARS 1
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

    #endif
`;

ShaderChunk["blur_pars"] = `
    #ifndef BLUR_PARS
    
    #define BLUR_PARS 1
    
    #ifndef VR_PARS
        #define textureVR(t, u) texture2D(t, u)
    #endif

    #ifndef BLUR_WEIGHT
        #define BLUR_WEIGHT(v, uv) v.a;
    #endif

    #define  BLUR_MAX_RADIUS 255

    float blur_gaussian_pdf(in float x, in float sigma) {
        return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;
    }

    vec4 blur_weighted(const float fSigma, const in sampler2D tex, const in vec2 uv, const in vec2 direction, const in vec2 resolution) {
        vec2 invSize = 1.0 / resolution;
        float weightSum = blur_gaussian_pdf(0.0, fSigma);
        vec4 diffuseSum = textureVR( tex, uv) * weightSum;
        for( int i = 1; i < BLUR_MAX_RADIUS; i ++ ) {
            if(float(i) > fSigma) break;
            float x = float(i);
            float w = blur_gaussian_pdf(x, fSigma);
            vec2 uvOffset = direction * invSize * x;
            vec2 uvv = uv + uvOffset;
            vec4 sample1 = textureVR( tex, uvv);
            float w1 = BLUR_WEIGHT(sample1, uvv);
            uvv = uv - uvOffset;
            vec4 sample2 = textureVR( tex, uvv);
            float w2 = BLUR_WEIGHT(sample1, uvv);
            diffuseSum += (sample1 * w1 + sample2 * w2) * w;
            weightSum += (w1 + w2) * w;
        }
        return diffuseSum/weightSum;
    }

    vec4 blur(const float fSigma, const in sampler2D tex, const in vec2 uv, const in vec2 direction, const in vec2 resolution) {
        vec2 invSize = 1.0 / resolution;
        float weightSum = blur_gaussian_pdf(0.0, fSigma);
        vec4 diffuseSum = textureVR( tex, uv) * weightSum;
        for( int i = 1; i < BLUR_MAX_RADIUS; i ++ ) {
            if(float(i) > fSigma) break;
            float x = float(i);
            float w = blur_gaussian_pdf(x, fSigma);
            vec2 uvOffset = direction * invSize * x;
            vec4 sample1 = textureVR( tex, uv + uvOffset);
            vec4 sample2 = textureVR( tex, uv - uvOffset);
            diffuseSum += (sample1 + sample2) * w;
            weightSum += 2.0 * w;
        }
        return diffuseSum/weightSum;
    }
                
    vec4 blur5(const in sampler2D tex, const in vec2 uv, const in vec2 direction, const in vec2 resolution) {
        vec4 color = vec4(0.0);
        vec2 off1 = vec2(1.3333333333333333) * direction;
        color += textureVR(tex, uv) * 0.29411764705882354;
        color += textureVR(tex, uv + (off1 / resolution)) * 0.35294117647058826;
        color += textureVR(tex, uv - (off1 / resolution)) * 0.35294117647058826;
        return color; 
    }

    vec4 blur9(const in sampler2D tex, const in vec2 uv, const in vec2 direction, const in vec2 resolution) {
        vec4 color = vec4(0.0);
        vec2 off1 = vec2(1.3846153846) * direction;
        vec2 off2 = vec2(3.2307692308) * direction;
        color += textureVR(tex, vUv) * 0.2270270270;
        color += textureVR(tex, vUv + (off1 / resolution)) * 0.3162162162;
        color += textureVR(tex, vUv - (off1 / resolution)) * 0.3162162162;
        color += textureVR(tex, vUv + (off2 / resolution)) * 0.0702702703;
        color += textureVR(tex, vUv - (off2 / resolution)) * 0.0702702703;
        return color; 
    }
    
    vec4 blur13(const in sampler2D tex, const in vec2 uv, const in vec2 direction, const in vec2 resolution) {
        vec4 color = vec4(0.0);
        vec2 off1 = vec2(1.411764705882353) * direction;
        vec2 off2 = vec2(3.2941176470588234) * direction;
        vec2 off3 = vec2(5.176470588235294) * direction;
        color += textureVR(tex, vUv) * 0.1964825501511404;
        color += textureVR(tex, vUv + (off1 / resolution)) * 0.2969069646728344;
        color += textureVR(tex, vUv - (off1 / resolution)) * 0.2969069646728344;
        color += textureVR(tex, vUv + (off2 / resolution)) * 0.09447039785044732;
        color += textureVR(tex, vUv - (off2 / resolution)) * 0.09447039785044732;
        color += textureVR(tex, vUv + (off3 / resolution)) * 0.010381362401148057;
        color += textureVR(tex, vUv - (off3 / resolution)) * 0.010381362401148057;
        return color; 
    }
    #endif
`;

export { index$3 as attach, fx as attachEffects, ecs as attachSystem };
