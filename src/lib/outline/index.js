import { WebGLRenderTarget } from "three"

export default function(scene, config) {
    var ping = new WebGLRenderTarget(1,1);
    var pong = new WebGLRenderTarget(1,1);
    
    var controlUniforms = {
        tint: { value: new THREE.Color(0x000000) },
        intensity: { value: 1 },
        normals: { value: 0.5 },
        radius: { value: 0.5 }
    }

    var prePass = getPass(`
        void main (void) {
            float depth = texture2D(depthTexture, vUv).r;
            float clipW = cameraProjectionMatrix[2][3] * (perspectiveDepthToViewZ( depth, cameraNear, cameraFar )) + cameraProjectionMatrix[3][3];
            vec4 clipPosition = vec4( ( vec3( vUv, depth ) - 0.5 ) * 2.0, 1.0 );
            clipPosition *= clipW;
            vec3 viewPosition = ( cameraInverseProjectionMatrix * clipPosition ).xyz;
                
            vec3 normal  = normalize(cross(dFdx(viewPosition), dFdy(viewPosition)));
            normal = normal * 0.5 + 0.5;
            gl_FragColor = vec4(normal.xy, )
        }
    
    `, {});
    var linePass = getPass(``, lineUniforms);
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
    

    return function (arg) {

    }
}