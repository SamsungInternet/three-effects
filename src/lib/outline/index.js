import { WebGLRenderTarget } from "three"

THREE.ShaderChunk["outline_pars"] = `
    uniform sampler2D outline_texture;
    uniform float outline_blend;
    uniform float outline_radius;
    uniform float outline_smooth;
    uniform vec3 outline_color;

    void outline_apply(inout vec4 color, vec2 uv) {
        vec4 texel = sampler2D(outline_texture, uv);
        float d = mix(length(texel.rg), texel.b, outline_blend);
        d = smoothstep(outline_radius, outline_radius + outline_smooth,  d);
        color = mix(color, outline_color, d);
    }
`;
export default function(scene, config) {
    var ping = new WebGLRenderTarget(1,1);
    var pong = new WebGLRenderTarget(1,1);
    
    var controlUniforms = {
        normalColor: { value: new THREE.Color(0x000000) },
        depthColor: { value: new THREE.Color(0x000000) },
        intensity: { value: 1 },
        factors: { value: [0.5, 0.5, 0.5] }
    }

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

    var prePass = getPass(`
        #include <vr_pars>

        uniform mat4 cameraProjectionMatrixLeft;
        uniform mat4 cameraProjectionMatrixRight;

        uniform mat4 cameraInverseProjectionMatrixLeft;
        uniform mat4 cameraInverseProjectionMatrixRight;
        
        
        void main (void) {
            mat4 projectionMatrix = selectVR(cameraProjectionMatrix, cameraProjectionMatrixLeft, cameraProjectionMatrixRight);
            mat4 inverseProjectionMatrix = selectVR(cameraInverseProjectionMatrix, cameraInverseProjectionMatrixLeft, cameraInverseProjectionMatrixRight);
            
            float depth = texture2D(depthTexture, vUv).r;
            float clipW = projectionMatrix[2][3] * (perspectiveDepthToViewZ( depth, cameraNear, cameraFar )) + projectionMatrix[3][3];
            vec4 clipPosition = vec4( ( vec3( vUv, depth ) - 0.5 ) * 2.0, 1.0 );
            clipPosition *= clipW;
            vec3 viewPosition = ( inverseProjectionMatrix * clipPosition ).xyz;
                
            vec3 normal  = normalize(cross(dFdx(viewPosition), dFdy(viewPosition)));
            normal = normal * 0.5 + 0.5;
            gl_FragColor = vec4(normal.xy, depth, 1.);
        }
    
    `, {});

    var sobelPass = getPass(`
        uniform sampler2D colorTexture;
        uniform vec2 resolution;

        float
        void main(void) {
            vec2 texel = vec2( 1.0 / resolution.x, 1.0 / resolution.y );

            // kernel definition (in glsl matrices are filled in column-major order)
    
            const mat3 Gx = mat3( -1, -2, -1, 0, 0, 0, 1, 2, 1 ); // x direction kernel
            const mat3 Gy = mat3( -1, 0, 1, -2, 0, 2, -1, 0, 1 ); // y direction kernel
    
            // fetch the 3x3 neighbourhood of a fragment
    
            // first column
    
            vec4 tx0y0 = texture2D( color, vUv + texel * vec2( -1, -1 ) );
            vec4 tx0y1 = texture2D( tDiffuse, vUv + texel * vec2( -1,  0 ) );
            vec4 tx0y2 = texture2D( tDiffuse, vUv + texel * vec2( -1,  1 ) );
    
            // second column
    
            vec4 tx1y0 = texture2D( tDiffuse, vUv + texel * vec2(  0, -1 ) );
            vec4 tx1y1 = texture2D( tDiffuse, vUv + texel * vec2(  0,  0 ) );
            vec4 tx1y2 = texture2D( tDiffuse, vUv + texel * vec2(  0,  1 ) );
    
            // third column
    
            vec4 tx2y0 = texture2D( tDiffuse, vUv + texel * vec2(  1, -1 ) );
            vec4 tx2y1 = texture2D( tDiffuse, vUv + texel * vec2(  1,  0 ) );
            vec4 tx2y2 = texture2D( tDiffuse, vUv + texel * vec2(  1,  1 ) );
    
            // gradient value in x direction
    
            vec4 valueGx = Gx[0][0] * tx0y0 + Gx[1][0] * tx1y0 + Gx[2][0] * tx2y0 + 
            	Gx[0][1] * tx0y1 + Gx[1][1] * tx1y1 + Gx[2][1] * tx2y1 + 
            	Gx[0][2] * tx0y2 + Gx[1][2] * tx1y2 + Gx[2][2] * tx2y2; 
    
            // gradient value in y direction
    
            vec4 valueGy = Gy[0][0] * tx0y0 + Gy[1][0] * tx1y0 + Gy[2][0] * tx2y0 + 
            	Gy[0][1] * tx0y1 + Gy[1][1] * tx1y1 + Gy[2][1] * tx2y1 + 
            	Gy[0][2] * tx0y2 + Gy[1][2] * tx1y2 + Gy[2][2] * tx2y2; 
    
            // magnitute of the total gradient
    
            vec4 G = sqrt( ( valueGx * valueGx ) + ( valueGy * valueGy ) );
    
            gl_FragColor = vec4( G.x, G.y, G.x + G.z * 1. / 256., 1. );
    
        }

    `, lineUniforms);

    var blurPass = getPass(`
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
    `, blurUniforms);
    

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
            m.uniforms.resolution.value.set(outputTarget.width, outputTarget.height);
        renderer.setRenderTarget(outputTarget);
        renderer.render(_scene, _ortho);
    }

    scene.addEventListener("afterRender", function (e) {
        
    });
    return function (arg) {

    }
}