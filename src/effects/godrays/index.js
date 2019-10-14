import * as THREE from "three";

THREE.ShaderChunk["godrays_pars"] = `
    uniform sampler2D godrays_texture;

    float godrays_blendScreen(float base, float blend) {
        return 1.0-((1.0-base)*(1.0-blend));
    }

    vec3 godrays_blendScreen(vec3 base, vec3 blend) {
        return vec3(godrays_blendScreen(base.r,blend.r),godrays_blendScreen(base.g,blend.g),godrays_blendScreen(base.b,blend.b));
    }

    vec3 godrays_blendScreen(vec3 base, vec3 blend, float opacity) {
	    return (godrays_blendScreen(base, blend) * opacity + base * (1.0 - opacity));
    }

	void godrays_main(inout vec4 color, vec2 uv) {
		vec4 texel = texture2D(godrays_texture, uv);
        color.rgb = godrays_blendScreen( color.rgb, texel.rgb, godrays_intensity * godrays_attenuation);
    }
`;

export default function (scene, config) {

    config = config || {};

    var inp = new THREE.WebGLRenderTarget(1,1);
    var ping = new THREE.WebGLRenderTarget(1,1);
    var pong = new THREE.WebGLRenderTarget(1,1);
    
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
       
    `, preUniforms);
    
    var blurUniforms = {
        colorTexture: { value: null },
        direction: { value: new THREE.Vector2(1, 0) },
        resolution: { value: new THREE.Vector2(1, 1) }
    }
    
    var blurPass = getPass(`
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
        `, blurUniforms)

    
    controlUniforms.strength = scene.userData.godrays_strength = postUniforms.strength;
    controlUniforms.radius = scene.userData.godrays_radius = postUniforms.radius;
    if (preUniforms.threshold) controlUniforms.threshold = scene.userData.godrays_threshold = preUniforms.threshold;
    scene.userData.godrays_texture = { value: ping[0].texture };

    scene.userData.godrays_internal = {prePass, blurPass};

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
        
        blurUniforms.step.value = Math.pow( 6, -1 );
        performPass(e.renderer, blurPass, inp, ping);
        
        blurUniforms.step.value = Math.pow( 6, -2 );
        performPass(e.renderer, blurPass, ping, pong);
        
        blurUniforms.step.value = Math.pow( 6, -3 );
        performPass(e.renderer, blurPass, pong, ping);
    };

    scene.addEventListener("afterPass", fn);

    var fr = function (e) {
        var w = e.size.x * 0.5, h = e.size.y * 0.5;
        inp.setSize(w, h);
        w = Math.floor(w * 0.5);
        h = Math.floor(h * 0.5);
        ping.setSize(w, h);
        pong.setSize(w, h);
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
            scene.removeEventListener("resizeEffects", fr);
            
            inp.dispose();
           
            ping.dispose();
            pong.dispose();
            blurPass;
            prePass.dispose();

            delete scene.userData.godrays_internal;

            //TODO Cleanup scene.userData;
        }
    }
}