import { ShaderChunk } from "three";

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

export default ShaderChunk;
