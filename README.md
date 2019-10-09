# three-effects

A minimal post processing framework for three.js 

## Usage

The library exposes a single generator function that takes THREE.Scene objects as argument and returns functions/closures tied to the provided scene object. 

The returned closures are used to set the final composition shader which will outputs to screen/hmd. The full fragment shader needs to be passed to the closure as it's single argument. The scene.userData property is used as the uniforms container for the final step.

A couple of default uniforms are provided on initialization, colorTexture and depthTexture, to give access to the color and depth textures that are generated from the base rendering.

## Effects

The Scene.onBeforeRender and onAfterRender callbacks are utilized to dispatch equivalent events during rendering to handle multiple recipients(the effect modules).

Pluggable effects attach listeners for these events, mostly AfterRender, to perform their operations which will generally be the generation of intermediate textures(like bloom and ssao) and setting up needed uniforms for the final compositing step.

All communication with the final step is handled via uniforms on the Scene.userData property. Effect modules can thus be entirely independent from the core mechanism.

Still a convention is encouraged where modules are defined a functions that get the scene object as argument. Inside they should attach listeners to the afterRender event on the scene, if they need to create intermediate textures from the base rendering. 

Effects should also attach the uniforms they need for the final compositing on the scene.userData property.

Finally, the function call should return a function/closure that when run, it will remove the effect's event listeners from the scene object and in general perform any cleanup needed. This format is useful for wrapping the functionality, eg as aframe components.

```js

    var effectModule = function(scene) {
        
        var textureUniform = { value: ... };
        
        scene.userData["effect_texture"] = textureUniform;

        function generateTextures (ev) {
            
            /* ev === { 
                type: "afterRender", 
                renderer, 
                scene,
                camera, 
                renderTarget,  // This is the final renderTarget, if null it means we output to screen
                realTarget // This is the renderTarget that contains the base scene rendering
            } */

            textureUniform.value = someGeneratedTexture;
        }

        // Attach listener so generateTextures run just after the scene is rendered
        scene.addEventListener("afterRender", generateTextures);
        
        // Return a function to perform cleanup if/when needed
        return function () {
            delete scene.userData["effect_texture"];
            scene.removeEventListener("afterRender", generateTextures);
        }
    }

    var attachEffects = require("three-effects");

    var fx = attachEffects(scene);

    fx(`
        uniform sampler2D effect_texture;

        void main(void) {

            // Fetch the base render, vUv is provided automatically and contains the coordinates
            // colorTexture and depthTexture sampler2Ds are also provided to get the base render

            vec4 base_color = texture2D(colorTexture, vUv);

            // Additively blend the effect texture with the base one, it could be bloom effect
            
            vec4 effect_color = texture2D(effect_texture, vUv);
            
            gl_FragColor = base_color + effect_color;
        }
    `);

```

## Preprocessor

The final composition step may need more than one pass. Effects that need adjacent pixel information, like FXAA or Glitch, will need to run on their own pass after the previous effect chain has been processed.

To deal with this, some simple shader preprocessor logic is provided.


```cpp
void main(void) {

    #if defined FX_PASS_1
        //do something like compositing bloom with the base color rendering
    #else
        // Final pass which needs to check nearby fully resolved pixels like Antialiasing
    #endif

}
```

defines like FX_PASS_N will be detected resulting in the generation of several shaders. These will be run using a ping pong rendertargets setup internally, and finally composited to screen (or whatever the original renderTarget was set at the time of calling renderer.render() );
