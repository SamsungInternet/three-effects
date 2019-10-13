# three-effects

A minimal framework for three.js development. It provides mechanisms for setting up post processing and entity component systems

## Post Processing

The library exposes the attachEffects function, which takes THREE.Scene objects as argument. and returns functions/closures tied to the provided scene object. 

The scene.onBeforeRender and onAfterRender properties are tapped to swap render targets internally in renderer.render and perform post processing transparently.

The returned closures are used to set the final composition shader which will output to the screen/hmd or whatever render target was bound when renderer.render was called. 

The full fragment shader needs to be passed to the closure as a string argument. The scene.userData property is used as the uniforms container for the final step.

Some default uniforms are provided on initialization, colorTexture and depthTexture, to give access to the color and depth textures that are generated from the base rendering.

### Multi Pass Compositing

Effects that need to access surrounding pixels, like FXAA or Glitch, will need to run on their own pass after all the pixels of the previous chain have been resolved.

To deal with this, some simple shader preprocessor logic to split the shader into multiple passes is provided using an uber shader approach with preprocessor defines.


```cpp
void main(void) {

    #if defined FX_PASS_1
        //do something like compositing bloom with the base color rendering
    #else
        // Final pass which needs to check nearby fully resolved pixels like Antialiasing
    #endif

}
```

Defines like FX_PASS_N will be detected resulting in the generation of several shaders/passes. The colorTexture uniform will always be the result of the previous pass.

### Effect Plugins

The Scene.onBeforeRender and onAfterRender callbacks are utilized to dispatch several events during rendering to handle multiple recipients(the effect modules).

Modules attach listeners for the event afterRender or afterPass, to perform their operations like generating textures and setting up uniforms for the final step.

All communication with the final step is handled via uniforms on the Scene.userData property. Effect modules can thus be entirely independent from the core mechanism.

Still a convention is encouraged where modules are defined a functions that get the scene object as argument, and attach listeners to afterRender on the scene. 

These functions should return a control function that when run with no argument, remove the event listeners from the scene object and perform any cleanup needed. 

Passing arguments on the control functions can be used for effect state updates. This convention is useful for wrapping the functionality, eg as aframe components. 

```js

    import { attachEffects } from "three-effects";

    var effectModule = function(scene) {
        
        var textureUniform = { value: ... };
        
        // Setup the uniforms to communicate with the final composition step
        scene.userData["effect_texture"] = textureUniform;

        function generateTexturesOnAfterRender (ev) {
            
            /* ev === { 
                type: "afterRender" || "beforeRender" || "afterPass" || "beforePass" || "afterEffects", 
                renderer, 
                scene,
                camera, 
                renderTarget,  // This is the final renderTarget, if null it means we output to screen
                realTarget // This is the renderTarget that contains the base scene rendering
            } */

            textureUniform.value = someGeneratedTexture;
        }

        function generateTexturesOnAfterPass (ev) {
            
            // afterPass can be dispatched multiple times. Check when to actually perform the work based on event.passId
            // For convenience, afterPass is also emmited right before the compositing starts with passId === undefined. 
            if(ev.passId !== "FX_PASS_N") return;

            textureUniform.value = someGeneratedTexture;

        }

        // Attach generateTextures on afterRender event to run it every frame after the scene is rendered(but before the final compositing step)
        scene.addEventListener("afterRender", generateTexturesAfterRender);

        // Alternatively listen on afterPass to tap anywhere in the final compositing pipeline. You'll need to check the event.passId property.
        scene.addEventListener("afterPass", generateTexturesAfterPass);
        
        // Return a function to control the instance and perform cleanup if/when needed
        return function (args) {
            if(!args) {
                delete scene.userData["effect_texture"];
                scene.removeEventListener("afterRender", generateTextures);
            } else {
                // use args to update the effect instance state
            }
        }
    }
    
    // Attach effects core on the scene object and get control function
    var fx = attachEffects(scene);

    
    // Attach an effect instance on the scene object. Keep reference of the instance control function
    var controlFunction = effectModule(scene);
    

    // Set final shader through the core control function, a null argument will disable post proc
    fx(`
        uniform sampler2D effect_texture;

        void main(void) {

            // Fetch the base render, vUv is provided automatically and contains the coordinates
            // colorTexture and depthTexture sampler2Ds are also provided to get the base render

            vec4 base_color = texture2D(colorTexture, vUv);

            // Additively blend the effect generated texture with the base one, it could be a bloom effect
            
            vec4 effect_color = texture2D(effect_texture, vUv);
            
            gl_FragColor = base_color + effect_color;
        }
    `);

```

## Entity Component Systems

TODO
