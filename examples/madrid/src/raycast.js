import { THREE, attachEffects, attachSystem, effectLib } from "../../../dist/three-effects.js";

export default function (renderer, scene, camera, assets) {
    
    var hands = [
        { controller: renderer.vr.getController(0), armed: false,  }
    ]
    
    function getHand(id) {
        var c = renderer.getController(id);
        return {
            controller: c,
            ray: new THREE.Ray(),
            armed: false,
            pressed: 0,
            object: null,
            mesh: new THREE.Mesh(THREE.CylinderBufferGeometry(0.04, 0.05, 1000, 16, 1, true), new THREE.MeshBasicMaterial({
                color: 0xDDEEFF,
                transparent: true
            }));
        }
    }
    
    var raycaster = new THREE.Raycaster();

    var event = { type: "", intersect: null};

    attachSystem(scene, "raycast", {
        init: function (e, objects, name) {
            var data = e.data || {};
            return {
                important: data.important || false
            }
        },

        beforeRender: function (e, objects, name) {
            hands.forEach(function (hand) {
                var currentObject = hand.object;
                var intersects = raycaster.intersectObjects( objects );
                
                if(intersects.length) {
                    var hit = intersects[0];
                    var obj = hit.object;
                    if(obj !== currentObject){
                        currentObject.dispatchEvent("raycast/enter");
                        if(currentObject) {
                            currentObject.dispatchEvent("raycast/leave");
                        }
                        currentObject = obj;
                    }
                    currentObject.dispatchEvent("raycast/move");
                } else if(currentObject){
                    currentObject.dispatchEvent("raycast/leave");
                    currentObject = null;
                }

                if(currentObject) {

                }
            })
        }
    })
}