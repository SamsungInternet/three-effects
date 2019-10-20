import * as THREE from "three";

THREE.ShaderChunk["filmgrain_pars"] = `
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
`

export default function (scene, config) {

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