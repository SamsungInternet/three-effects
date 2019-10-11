export default function (scene, config) {

    config = config || {};

    var ping = [ new THREE.WebGLRenderTarget(1,1), new THREE.WebGLRenderTarget(1,1), new THREE.WebGLRenderTarget(1,1) ];
    var pong = [ new THREE.WebGLRenderTarget(1,1), new THREE.WebGLRenderTarget(1,1), new THREE.WebGLRenderTarget(1,1) ];
    
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
            depthTest: false,
            extensions: {
                derivatives: true,
                shaderTextureLOD: true
            },
            fog: false,
            lights: false
        });
    }

    var preUniforms = config.inputUniforms || {
        colorTexture: { value: null },
        threshold: { value: config.threshold || 0.9 },
        smooth: { value: config.smooth || 0.01 }
    }

    var prePass = getPass(config.inputShader || `
        uniform sampler2D colorTexture;

        void main(void) {
            vec4 texel = texture2D( colorTexture, vUv );

			vec3 luma = vec3( 0.299, 0.587, 0.114 );

			float v = dot( texel.xyz, luma );

			vec4 outputColor = vec4( 0., 0., 0., 1. );

			float alpha = smoothstep( threshold, threshold + smooth, v );

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
        strength: { value: 0 },
        radius: { value: 0 },
        blurTexture1: { value: pong[0] },
        blurTexture2: { value: pong[1] },
        blurTexture3: { value: pong[2] },
        colorTexture: { value: null }
	};

    scene.userData.bloom_strength = postUniforms.strength;
    scene.userData.bloom_radius = postUniforms.radius;
    if (preUniforms.threshold) scene.userData.bloom_threshold = preUniforms.threshold;
    scene.userData.bloom_texture = { value: pong[0].texture };

    var postPass = getPass(`
        uniform sampler2D blurTexture1;
        uniform sampler2D blurTexture2;
        uniform sampler2D blurTexture3;
        uniform float strength;
        uniform float radius;
        
        float lerpBloomFactor(const in float factor) {
            float mirrorFactor = 1.2 - factor;
            return mix(factor, mirrorFactor, radius);
        }

        void main() {
            gl_FragColor = strength * ( lerpBloomFactor(1.) *  texture2D(blurTexture1, vUv) + \
                                            lerpBloomFactor(0.66) *  texture2D(blurTexture2, vUv) + \
                                            lerpBloomFactor(0.33) *  texture2D(blurTexture3, vUv) );\
        }
    `, postUniforms);

    var fn = function (e) {
        var rt = e.renderTarget;
        
        blurUniforms.VR = scene.userData.VR;

        performPass(prePass, e.renderTarget, ping[0]);

        for(var i=0; i< 3; i++) {
            blurUniforms.resolution.value.set(w, h);
            
            blurUniforms.direction.value.set(0, 1);
            performPass(blurPasses[i], i ? ping[i - 1] : ping[0], pong[ i]);
            
            blurUniforms.direction.value.set(1, 0);
            performPass(blurPasses[i], pong[i], ping[i]);
            
            w *= 0.5;
            h *= 0.5;
        }

        performPass(postPass, ping[i], pong[0]);

    };

    scene.addEventListener("afterRender", fn);

    return function () {
        
        scene.removeEventListener("afterRender", fn);
        
        for(var i=0; i<3; i++) {
            ping[i].dispose();
            pong[i].dispose();
            blurPasses[i].dispose();
        }

        prePass.dispose();
        postPass.dispose();

        delete scene.userData.bloom_strength;
        delete scene.userData.bloom_radius;
        delete scene.userData.bloom_threshold;
        
    }
}