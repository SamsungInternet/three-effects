import { THREE, attachSystem } from "../../../dist/three-effects.js";

export default function (scene, config) {
    config = config || {};

    var holdDuration = config.holdDuration || 1000;

    function getHand(renderer, id) {
        var c = renderer ? renderer.vr.getController(id) : new THREE.Group();
        
        var ret = {
            index: id || 0,
            controller: c,
            ray: new THREE.Ray(),
            armed: false,
            pressTime: 0,
            pressed: false,
            object: null,
            mesh: renderer ? new THREE.Mesh(new THREE.CylinderBufferGeometry(0.01, 0.01, 1, 6, 1, true), new THREE.MeshBasicMaterial({
                color: 0xDDEEFF,
                transparent: true,
                depthTest: false,
                depthWrite: false
            })) : new THREE.Group(),
            raycaster: new THREE.Raycaster(),
            isMouse: !renderer
        }
        
        ret.mesh.visible = false;

        if(ret.mesh.material) {
            ret.mesh.material.opacity = 0.33;            
            scene.add(ret.mesh);
        }

        ret.startFn = function (e) {
            ret.armed = true;
            ret.pressed = true;
            ret.pressTime = window.performance.now();
            if(ret.object) dispatch(ret.object, ret.hit || event, "interact/press")
        }

        ret.endFn = function (e) {
            ret.pressed = false;
            if(ret.object && ret.armed) dispatch(ret.object, ret.hit || event, "interact/release");
            ret.armed = false;
        }
        
        c.addEventListener("selectstart", ret.startFn);
        c.addEventListener("selectend", ret.endFn);
        
        return ret;
    }
    
    var nohands = [getHand()];
    var hands;
    
    var event = { type: ""};

    function dispatch(obj, ev, s) {
        ev.type = s;
        if(s !== "interact/move" && config.debug)   console.log(s, ev.hand.index);
        obj.dispatchEvent(ev);
       
    }

    var vfrom = new THREE.Vector3(0, 0, 1);

    var mouse = new THREE.Vector2();

    var isRotating = false;

    if(config.debug) {
        
        nohands[0].mesh.visible = true;

        function onMouseMove( event ) {
            mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
            mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
        
        }

        window.addEventListener( 'mousemove', onMouseMove, false );

        
        function onMouseDown( event ) {
            if(event.which === 3) {
                isRotating = true;
            } else {
                nohands[0].controller.dispatchEvent({ type: "selectstart" });
            }
        }
        
        window.addEventListener( 'mousedown', onMouseDown, false );

        function onMouseUp( event ) {
            if (event.which === 3) {
                isRotating = false;
            } else {
                nohands[0].controller.dispatchEvent({ type: "selectend" });
            }
        }

        window.addEventListener( 'mouseup', onMouseUp, false );

        document.body.addEventListener("contextmenu", function(evt){evt.preventDefault();return false;});
    }

    var euler = new THREE.Euler( 0, 0, 0, 'YXZ' );

    attachSystem(scene, "interact", {
        init: function (e, objects, name) {
            var data = e.data || {};
            return {
                important: data.important || false
            }
        },

        beforeRender: function (e, objects, name) {
            if(!hands)  hands = [getHand(e.renderer, 0), getHand(e.renderer, 1)];

            var t = window.performance.now();

            (e.renderer.vr.isPresenting() ? hands : nohands).forEach(function (hand) {
                var currentObject = hand.object;
                var c = hand.controller;
                hand.mesh.visible = c.visible;

                if(!c.visible) return;

                var r = hand.ray;

                if(hand.isMouse) {
                    if(isRotating) {
                        euler.y += -mouse.x * 0.01;
                        euler.x += mouse.y * 0.01;
                        euler.x = Math.min(Math.PI * 0.49, Math.max(-Math.PI * 0.49, euler.x));
                        e.camera.quaternion.setFromEuler(euler);
                    }
                    hand.raycaster.setFromCamera( mouse, e.camera );
                } else {
                    c.getWorldPosition(r.origin);
                    c.getWorldDirection(r.direction);
                    hand.raycaster.ray.origin.lerp(r.origin, 0.2);
                    hand.raycaster.ray.direction.lerp(r.direction, 0.1);
                }
                
                hand.mesh.quaternion.setFromUnitVectors( vfrom, hand.raycaster.ray.direction );
                
                hand.mesh.position.copy( hand.raycaster.ray.origin);

                var intersects = hand.raycaster.intersectObjects( objects );
                
                delete hand.hit;

                event.hand = hand;
                
                if(intersects.length) {
                    var hit = intersects[0];
                    var obj = hit.object;
                    hit.hand = hand;
                    hand.hit = hit;

                    hand.mesh.scale.z = hit.distance;

                    if(obj !== currentObject){
                        dispatch(obj, hit, "interact/enter");
                        if(currentObject) {
                            hand.armed = false;
                            dispatch(currentObject, event, "interact/leave");
                        }
                        currentObject = obj;
                    }
                    
                    hand.hold = hand.armed ? (t - hand.pressTime) / holdDuration : 0;
                    
                    if(hand.armed && t >= hand.pressTime + holdDuration){
                        dispatch(obj, hit, "interact/hold");
                        hand.hold = 0;
                        hand.armed = false;
                        hand.pressTime = t;
                    } 

                    dispatch(currentObject, hit, "interact/move");
                } else if(currentObject){
                    hand.armed = false;
                    hand.hold = 0;
                    dispatch(currentObject, event, "interact/leave");
                    currentObject = null;
                }

                hand.object = currentObject;
            })
        }
    })
}