import { attachSystem, THREE } from "../../../dist/three-effects";
import { deflateRaw } from "zlib";

export default function (scene) {

    var _scene;

    attachSystem(scene, "label", {
        init: function (e, objects, name) {
            var ret = {
                image: new Image(),
                visible: true,
                text: "",
                font: ""
            };

            ret.mesh = new THREE.Sprite(new THREE.SpriteMaterial( { map: new THREE.Texture(ret.image), color: 0xffffff } ));

            ret.image.addEventListener("onload", function () {
                ret.mesh.material.map.needsUpdate = true;
            });
            
            _scene.add(ret.mesh);

            return ret;
        },

        remove: function (e, objects, name) {
            var d = e.entity.userData[name];
            d.mesh.material.map.dispose();
            d.mesh.material.dispose();
            _scene.remove(d.mesh);
        },

        afterEffects: function(e, objects, name) {
            objects.forEach(function (obj) {
                var d = obj.userData[name];
                
                if(d._text !== d.text || d._font !== d.font) draw(d);
                
                project(obj, d);
            });

            e.renderer.render(_scene, e.camera);
        }
    });

    function draw(d) {
        d.mesh.material.map.image.src = `data:image/svg,<svg viewBox="0 0 1000 80" xmlns="http://www.w3.org/2000/svg">
        <text x="500" y="35" text-anchor="middle" fill="white" font="${d.font}">${d.text}</text></svg>`;

        d.mesh.material.map.needsUpdate = true;

        d._text = d.text;
        d._font = d.font;
    }

    var vec = new THREE.Vector3();

    function project(obj, d) {
        if(!d.visible || !obj.visible) {
            d.mesh.visible = false;
            return;
        }

        d.mesh.visible = true;
        
        obj.getWorldPosition(d.mesh.position);
        if(!obj.boundingSphere) obj.computeBoundingSphere();
        
        obj.getWorldScale(vec);

        d.mesh.position.y += obj.boundingSphere.radius * Math.max(Math.max(sc.x, sc.y), sc.z);
    }
}