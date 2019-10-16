import { THREE, attachEffects, attachSystem, effectLib } from "../../../dist/three-effects.js";

export default function (renderer, scene, camera, assets) {
    var holdDuration = 1618;

    function getHand(id) {
        var c = renderer.getController(id);
        
        var ret = {
            index: id,
            controller: c,
            ray: new THREE.Ray(),
            armed: false,
            pressTime: 0,
            object: null,
            mesh: new THREE.Mesh(THREE.CylinderBufferGeometry(0.04, 0.05, 1000, 16, 1, true), new THREE.MeshBasicMaterial({
                color: 0xDDEEFF,
                transparent: true
            })),
        }
        
        ret.startFn = function (e) {
            ret.armed = true;
            ret.pressedAt = window.performance.now();
            dispatch(ret.object, event, "interact/press")
        }

        ret.endFn = function (e) {
            if(ret.object && ret.armed) dispatch(ret.object, event, "interact/release");
            ret.armed = false;
        }
        
        c.addEventListener("selectstart", startFn);
        c.addEventListener("selectend", startFn);
        
        return ret;
    }
    
    var hands = [getHand(0), getHand(1)];
    
    var raycaster = new THREE.Raycaster();

    var event = { type: "", intersect: null};

    function dispatch(obj, ev, s) {
        ev.type = s;
        obj.dispatchEvent(ev);
    }

    attachSystem(scene, "raycast", {
        init: function (e, objects, name) {
            var data = e.data || {};
            return {
                important: data.important || false,
                label: data.label || ""
            }
        },

        beforeRender: function (e, objects, name) {
            var t = window.performance.now();

            hands.forEach(function (hand) {
                var currentObject = hand.object;
                var intersects = raycaster.intersectObjects( objects );
                
                if(intersects.length) {
                    var hit = intersects[0];
                    var obj = hit.object;
                    hit.hand = hand;
                    if(obj !== currentObject){
                        dispatch(obj, hit, "interact/enter");
                        if(currentObject) {
                            hand.armed = false;
                            dispatch(currentObject, event, "interact/leave");
                        }
                        currentObject = obj;
                    } 
                    
                    hit.hold = hand.armed ? (t - hand.pressTime) / holdDuration : 0;
                    
                    if(hand.armed && t >= hand.pressTime + holdDuration){
                        hit.hold=1;
                        hand.armed = false;
                        dispatch(obj, hit, "interact/hold");
                    } else {
                        hit.hold = hand.armed ? (t - hand.pressTime) / holdDuration : 0;
                    }
                    
                    dispatch(currentObject, hit, "interact/trace");
                } else if(currentObject){
                    hand.armed = false;
                    dispatch(currentObject, event, "interact/leave");
                    currentObject = null;
                }

                hand.object = currentObject;
            })
        }
    })
}