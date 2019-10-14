import * as THREE from "three";

THREE.ShaderChunk.colors = `
    uniform sampler2D colors_texture;

    void colors_apply(inout vec4 fragColor, vec2 uv) {
        #ifndef COLORS_NO_CLAMP
            fragColor = clamp(fragColor, 0.0, 1.0);
        #endif

        mediump float blueColor = fragColor.b * 63.0;

        mediump vec2 quad1;
        quad1.y = floor(floor(blueColor) / 8.0);
        quad1.x = floor(blueColor) - (quad1.y * 8.0);

        mediump vec2 quad2;
        quad2.y = floor(ceil(blueColor) / 8.0);
        quad2.x = ceil(blueColor) - (quad2.y * 8.0);

        highp vec2 texPos1;
        texPos1.x = (quad1.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * fragColor.r);
        texPos1.y = (quad1.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * fragColor.g);

        #ifdef COLORS_FLIP_Y
            texPos1.y = 1.0-texPos1.y;
        #endif

        highp vec2 texPos2;
        texPos2.x = (quad2.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * fragColor.r);
        texPos2.y = (quad2.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * fragColor.g);

        #ifdef COLORS_FLIP_Y
            texPos2.y = 1.0-texPos2.y;
        #endif

        lowp vec4 newColor1 = texture2D($texture, texPos1);
        lowp vec4 newColor2 = texture2D($texture, texPos2);

        fragColor = mix(newColor1, newColor2, fract(blueColor));
    }

    vec3 colors_rgb2hsv(vec3 c){
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    vec3 colors_hsv2rgb(vec3 c)
    {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
`;

export default function (scene) {
    var controlUniform = {value: null};
    scene.userData["bloom_texture"] = controlUniform;

    return function(arg) {
        if(arg) {
            if(arg.texture) controlUniform.value = arg.texture;
        } else {
            delete scene.userData["bloom_texture"];
        }
    }
}