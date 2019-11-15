import * as THREE from "three";

export default {
    init: function (ev, objects, name) {
        THREE.ShaderChunk[name + "_pars"] = `
            uniform float ${name}_time;
            uniform float ${name}_speed;
            uniform float ${name}_sCount;
            uniform float ${name}_sIntensity;
            uniform float ${name}_nIntensity;
            
            void ${name}_apply(inout vec4 color, in vec2 uv) {
                vec4 cTextureScreen = color;
                float dx = rand( uv + mod(${name}_time, 3.14) );
                vec3 cResult = cTextureScreen.rgb + cTextureScreen.rgb * clamp( 0.1 + dx, 0.0, 1.0 );
                vec2 sc = vec2( sin( uv.y * ${name}_sCount ), cos( uv.y * ${name}_sCount ) );
                cResult += cTextureScreen.rgb * vec3( sc.x, sc.y, sc.x ) * ${name}_sIntensity;
                cResult = cTextureScreen.rgb + clamp( ${name}_nIntensity, 0.0,1.0 ) * ( cResult - cTextureScreen.rgb );
                color.rgb =  cResult;
            }
        `;

        var scene = ev.entity;
    
        var controlUniforms = {
            "time":       { type: "f", value: 0.0 },
            "speed":       { type: "f", value: 1.0 },
            "nIntensity": { type: "f", value: 0.3 },
            "sIntensity": { type: "f", value: 0.03 },
            "sCount":     { type: "f", value: 4096 }
        };

        for(let k in ev) {
            if(k in controlUniforms){
                controlUniforms[k].value = ev[k];
            }
        }
        
        for(let k in controlUniforms){
            scene.userData[name + "_" + k] = controlUniforms[k];
        }
        
        controlUniforms[""] = function () {
            for(let k in controlUniforms){
                delete scene.userData[name + "_" + k];
            }
        }

        return controlUniforms;
    },

    remove: function (ev) {
        ev.entity.userData[name][""]();
    }
}