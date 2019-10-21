import {THREE, attachSystem} from "../../../dist/three-effects.js";

export default function(scene) {

    var inDuration = 600;

    attachSystem(scene, "popin", {
        init: function(e, objects, name) {
            var pos = new THREE.Vector3();
            pos.copy(e.entity.position);
            e.entity.position.y += 100;
            return {
                target: pos,
                time: window.performance.now()
            }
        },

        beforeRender: function (e, objects, name) {
            var t = window.performance.now();
            var updateShadow = false;

            objects.forEach(function (obj) {                
                
                var d = obj.userData[name];

                if(d.finished) return;
                
                var pc = Math.max(0, Math.min(1, (t - d.time) / inDuration));
                
                obj.position.lerp(d.target, pc);
                
                updateShadow = true;
                
                if(pc === 1) d.finished = true;
            });

            if(updateShadow) e.renderer.shadowMap.needsUpdate = true;

        }
    });

    var outDuration = 300;

    attachSystem(scene, "popout", {
        init: function(e, objects, name) {
            return {
                time: window.performance.now()
            }
        },

        beforeRender: function (e, objects, name) {
            var t = window.performance.now();
            var updateShadow = false;

            objects.slice(0).forEach(function (obj) {                
                
                var d = obj.userData[name];
                
                var pc = 1 - Math.max(0, Math.min(1, (t - d.time) / outDuration));
                
                obj.scale.set(pc, pc, pc);
                
                updateShadow = true;
                
                if(pc === 0){
                    Object.keys(obj.userData).forEach(function(k) {
                        scene.dispatchEvent({ type: k + "/unregister", entity: obj });
                    });
                    obj.parent.remove(obj);
                }
            });

            if(updateShadow) e.renderer.shadowMap.needsUpdate = true;

        }
    });

}