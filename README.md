# three-effects

A minimal framework for three.js development. It eases the implemention of performant post processing and entity component systems

## Post Processing

The library works by attaching listeners on the scene.onBeforeRender and onAfterRender and after that post processing happens automatically when renderer.render is called with the enchanced scene object.

A single function, attachEffects, is exposed from the module that takes THREE.Scene objects as argument and returns functions/closures tied to the provided scene object. 

Internally, attachEffects binds the scene.onBeforeRender and .onAfterRender callback handlers to swap render targets and perform post processing transparently.

The returned control function is used as the final composition shader which outputs to the screen/hmd or whatever render target was bound when renderer.render() was called. 

The full fragment shader needs to be passed to the function as a string argument. The scene.userData property is used as the uniforms container for the final step.

Some default uniforms are provided on initialization, colorTexture and depthTexture, to give access to the color and depth textures that are generated from the base rendering.

### Multi Pass Compositing

Effects that need to access surrounding pixels, like FXAA or Glitch, will need to run on a pass of their own after all the pixels of the previous chain have been resolved.

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

Still a convention is encouraged where modules are defined a functions that get the scene object as argument, and attach listeners to events on the scene. 

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
            
            // afterPass may be dispatched multiple times. You can set when to actually perform the work based on event.passId which will be "main" during the last pass. 
            if(ev.passId !== "FX_PASS_N") return;

            textureUniform.value = someGeneratedTexture;

        }

        // Attach generateTextures on afterRender event to run it every frame after the scene is rendered(but before the final compositing step passes)
        scene.addEventListener("afterRender", generateTexturesAfterRender);

        // Alternatively listen on beforePass/afterPass to tap anywhere in the final compositing pipeline. You'll need to check the event.passId property.
        scene.addEventListener("afterPass", generateTexturesAfterPass);
        
        // afterEffects is emmited once all the passes are completed and the original renderTarget set and drawn. Texts/hud should be drawn here directly.
        scene.addEventListener("afterEffects", generateTexturesAfterRender);
        
        // Return an control function to control the effect instance and perform cleanup if/when needed
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

    
    // We don't need to do anything special with the renderer. Just render the enhanced scene and the output will be post processed
    renderer.render(scene, camera);

    // Passing null will disable post processing for the associated scene
    fx(null);

    // This is just a convention but having effects return a control function to configure/cleanup effects is recommended 
    controlFunction(null);

```
## Builtin Effects

The library exposes some builtin effects throught an "attach" map of functions using the format described above. Currently bloom, filmgrain, fxaa, glitch are provided

```js
    
    import {attachEffects, attach} from "three-effects"

    var fx = attachEffects(scene);

    var bloomControl = attach.bloom(scene);

    bloomControl({ strength: 0.5, radius: 1, threshold: 0.5 });

```

## Entity Component Systems

TODO
