import { attachSystem, THREE } from "../../../dist/three-effects.js";

export default function (scene) {

    var _scene = new THREE.Scene();

    attachSystem(scene, "label", {
        init: function (e, objects, name) {
            var ret = {
                image: new Image(),
                visible: e.visible !== undefined ? e.visible : true,
                text: e.text || "",
                font: e.font || "verdana",
                scale: e.scale || 1
            };

           
            ret.mesh = new THREE.Sprite(new THREE.SpriteMaterial( { 
                map: new THREE.Texture(ret.image), 
                color: 0xffffff,
                transparent: true
            } ));

            ret.mesh.visible = ret.visible;

            ret.mesh.material.map.minFilter = THREE.LinearFilter;

            ret.mesh.material.map.image.onload = function () {
                ret.mesh.material.map.needsUpdate = true;
            };
            
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

            var old = e.renderer.autoClear;
            e.renderer.autoClear = false;
            e.renderer.render(_scene, e.camera);
            e.renderer.autoClear = old;
        }
    });

    function draw(d) {
        var el = document.createElement("div");
        el.innerHTML = `<svg width="0" height="0" viewBox="0 0 100 128" xmlns='http://www.w3.org/2000/svg'>
        <text text-rendering="optimizeLegibility" x="110" y="15" fill="black" alignment-baseline="middle" 
        text-anchor="middle" font-size="200px" font-family="${d.font}">${d.text}</text>
            <text id="bounds" text-rendering="optimizeLegibility" x="100" y="5" fill="white" alignment-baseline="middle" 
            text-anchor="middle" font-size="200px" font-family="${d.font}">${d.text}</text>
            
            </svg>`;

        document.body.appendChild(el); 

        var bbox = el.querySelector("#bounds").getBBox(); 
        var svg = el.querySelector("svg");

        var pad = 20;
        svg.setAttribute("viewBox", [bbox.x - pad / 2 , bbox.y - pad / 2, bbox.width + pad,bbox.height + pad].join(" "));
        svg.setAttribute("width", bbox.width + pad);
        svg.setAttribute("height", bbox.height + pad);
        
        d.mesh.scale.set(bbox.width/bbox.height * d.scale, d.scale,1);

        document.body.removeChild(el);

        d.mesh.material.map.image.src = "data:image/svg+xml;utf8," + el.innerHTML;
        
        d._text = d.text;
        d._font = d.font;
    }

    var box = new THREE.Box3();

    function project(obj, d) {
        if(!d.visible || !obj.visible) {
            d.mesh.visible = false;
            return;
        }

        d.mesh.visible = true;
        
        if(!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
        
        box.copy(obj.geometry.boundingBox);
        box.applyMatrix4(obj.matrixWorld);

        obj.getWorldPosition(d.mesh.position);

        d.mesh.position.y = box.max.y + d.mesh.scale.y;

    }
}