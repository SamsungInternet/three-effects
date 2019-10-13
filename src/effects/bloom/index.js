import * as THREE from "three";

THREE.ShaderChunk["bloom_pars"] = `
    uniform sampler2D bloom_texture;

    void bloom_apply(inout vec4 fragColor, in vec2 uv) {
        fragColor += texture2D(bloom_texture, uv);
    }
`;

export default function (scene, config) {

    config = config || {};

    var inp = new THREE.WebGLRenderTarget(1,1);
    var ping = [ new THREE.WebGLRenderTarget(1,1), new THREE.WebGLRenderTarget(1,1), new THREE.WebGLRenderTarget(1,1) ];
    var pong = [ new THREE.WebGLRenderTarget(1,1), new THREE.WebGLRenderTarget(1,1), new THREE.WebGLRenderTarget(1,1) ];
    
    var passId = config.passId;

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
			float alpha = smoothstep( threshold, threshold + 0.01, v );
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

            uniform sampler2D colorTexture;
            uniform vec2 direction;
            uniform vec2 resolution;
            
            void main(void) {
                vec4 color = vec4(0.0);
                vec2 off1 = vec2(1.3333333333333333) * direction;
                color += textureVR(colorTexture, vUv) * 0.29411764705882354;
                color += textureVR(colorTexture, vUv + (off1 / resolution)) * 0.35294117647058826;
                color += textureVR(colorTexture, vUv - (off1 / resolution)) * 0.35294117647058826;
                gl_FragColor = color; 
              }
        `, blurUniforms),
        getPass(`
            #include <vr_pars>

            uniform sampler2D colorTexture;
            uniform vec2 direction;
            uniform vec2 resolution;
            
            void main(void) {
                vec4 color = vec4(0.0);
                vec2 off1 = vec2(1.3846153846) * direction;
                vec2 off2 = vec2(3.2307692308) * direction;
                color += textureVR(colorTexture, vUv) * 0.2270270270;
                color += textureVR(colorTexture, vUv + (off1 / resolution)) * 0.3162162162;
                color += textureVR(colorTexture, vUv - (off1 / resolution)) * 0.3162162162;
                color += textureVR(colorTexture, vUv + (off2 / resolution)) * 0.0702702703;
                color += textureVR(colorTexture, vUv - (off2 / resolution)) * 0.0702702703;
                gl_FragColor = color; 
            }
        `, blurUniforms),
        getPass(`
            #include <vr_pars>

            uniform sampler2D colorTexture;
            uniform vec2 direction;
            uniform vec2 resolution;
            
            void main(void) {
                vec4 color = vec4(0.0);
                vec2 off1 = vec2(1.411764705882353) * direction;
                vec2 off2 = vec2(3.2941176470588234) * direction;
                vec2 off3 = vec2(5.176470588235294) * direction;
                color += textureVR(colorTexture, vUv) * 0.1964825501511404;
                color += textureVR(colorTexture, vUv + (off1 / resolution)) * 0.2969069646728344;
                color += textureVR(colorTexture, vUv - (off1 / resolution)) * 0.2969069646728344;
                color += textureVR(colorTexture, vUv + (off2 / resolution)) * 0.09447039785044732;
                color += textureVR(colorTexture, vUv - (off2 / resolution)) * 0.09447039785044732;
                color += textureVR(colorTexture, vUv + (off3 / resolution)) * 0.010381362401148057;
                color += textureVR(colorTexture, vUv - (off3 / resolution)) * 0.010381362401148057;
                gl_FragColor = color; 
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
        
        float lerpBloomFactor(const in float factor) {
            float mirrorFactor = 1.25 - factor;
            return mix(factor, mirrorFactor, radius);
        }

        void main() {
            gl_FragColor = strength * ( lerpBloomFactor(1.) *  texture2D(blurTexture1, vUv) + \
                                            lerpBloomFactor(0.5) *  texture2D(blurTexture2, vUv) + \
                                            lerpBloomFactor(0.25) *  texture2D(blurTexture3, vUv) );\
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

    scene.addEventListener("afterPass", fn);

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
            for ( var k in arg) {
                if (controlUniforms[k]) {
                    controlUniforms[k].value = arg[k];
                }
            }
        } else {
            scene.removeEventListener("afterPass", fn);
            scene.removeEventListener("afterEffects", fr);
            
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