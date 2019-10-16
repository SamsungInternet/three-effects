import * as THREE from "three";

THREE.ShaderChunk["bloom_pars"] = `
    uniform sampler2D bloom_texture;

    void bloom_apply(inout vec4 fragColor, in vec2 uv) {
        fragColor.rgb += texture2D(bloom_texture, uv).rgb;
    }
`;

export default function (scene, config) {

    config = config || {};

    var inp = new THREE.WebGLRenderTarget(1,1);
    var ping = [ new THREE.WebGLRenderTarget(1,1), new THREE.WebGLRenderTarget(1,1), new THREE.WebGLRenderTarget(1,1) ];
    var pong = [ new THREE.WebGLRenderTarget(1,1), new THREE.WebGLRenderTarget(1,1), new THREE.WebGLRenderTarget(1,1) ];
    
    var passId = config.before || "main";

    function getPass(src, uniforms) {
        return new THREE.ShaderMaterial({
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
    }

    var prePass = getPass(config.inputShader || `
        uniform sampler2D colorTexture;
        uniform sampler2D depthTexture;
        uniform float threshold;

        void main(void) {
            vec4 texel = texture2D( colorTexture, vUv );
			vec3 luma = vec3( 0.299, 0.587, 0.114 );
			float v = dot( texel.xyz, luma );
			vec4 outputColor = vec4( 0., 0., 0., 1. );
            float alpha = smoothstep( threshold, threshold + 0.005, v );
            
			gl_FragColor = mix( outputColor, texel, alpha );
        }
    `, preUniforms);
    
    var blurUniforms = {
        colorTexture: { value: null },
        direction: { value: new THREE.Vector2(1, 0) },
        resolution: { value: new THREE.Vector2(1, 1) }
    }
    
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
            gl_FragColor = strength * ( lerpBloomFactor(1., 0.33) *  texture2D(blurTexture1, vUv) + \
                                            lerpBloomFactor(0.33, 0.66) *  texture2D(blurTexture2, vUv) + \
                                            lerpBloomFactor(0.33, 1.) *  texture2D(blurTexture3, vUv) );\
        }
    `, postUniforms);

    scene.userData.bloom_internal = {prePass, blurPasses, postPass};

    var _scene = new THREE.Scene();
    var _ortho = new THREE.OrthographicCamera(1,1,1,1,1,10);
    var _quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2,2), null);
    _quad.frustumCulled = false;
    _scene.add(_quad);

    function performPass(renderer, m, inputTarget, outputTarget) {
        _quad.material = m;
        if (m.uniforms.colorTexture)
            m.uniforms.colorTexture.value = inputTarget ? inputTarget.texture : null;
        if (m.uniforms.depthTexture)
            m.uniforms.depthTexture.value = inputTarget ? inputTarget.depthTexture: null;
        if (m.uniforms.resolution) 
            m.uniforms.resolution.value.set(inputTarget.width, inputTarget.height);
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
    }

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