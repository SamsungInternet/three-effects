import { attachSystem, THREE } from "../../../dist/three-effects.js";

export default function (scene, config) {

    config = config || {}

    var _scene = new THREE.Scene();

    var lods = config.lods || [0, 10];

    var template = config.template || function(d, lod) {
        var w = lod ? 256 : 1024;
        var h = lod ? 64 : 256;

        var text = lod ?  d.text.toUpperCase() : d.text;
        
        var samsung = `
        <svg version="1.1" id="Livello_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
            viewBox="0 0 4838 1606.3" style="enable-background:new 0 0 4838 1606.3;" xml:space="preserve">
        <style type="text/css">
            .st0{fill:#034EA2;}
            .st1{fill:#FFFFFF;}
        </style>
        <g>
            <g>
                <g>
                    <path class="st0" d="M4835,382.5c65.9,377.7-962.3,872.3-2296.8,1104.7C1203.9,1719.6,68.8,1601.7,3,1223.8
                        C-62.8,846.1,965.7,351.6,2300,119.3C3634.4-113.3,4769.3,4.7,4835,382.5z"/>
                </g>
                
            </g>
        </g>
        </svg>
        `;
        return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns='http://www.w3.org/2000/svg' xmlns:xlink="http://www.w3.org/1999/xlink">` +
        (lod ? "" : `
        <image xlink:href="data:image/svg+xml;utf8,${encodeURIComponent(samsung)}" x="0" y="0" height="256" width="1024"/> `) +
        `<text text-rendering="optimizeLegibility" x="${w/2 + w/100}" y="${h/2 + h/100}" fill="black" alignment-baseline="middle" 
        text-anchor="middle" transform = "rotate(${lod ? 0: -8} ${w/2} ${h/2})" font-size="${h * (0.6 - 0.02 * text.length)}px"  font-family="${d.font || 'monospace'}">${text}</text>

        <text text-rendering="optimizeLegibility" x="${w/2}" y="${h/2}" fill="white" alignment-baseline="middle" 
        text-anchor="middle" transform = "rotate(${lod ? 0 : -8} ${w/2} ${h/2})" font-size="${h * (0.6 - 0.02 * text.length)}px" font-family="${d.font || 'monospace'}">${text}</text>

        </svg>`;
    }

    attachSystem(scene, "label", {
        init: function (e, objects, name) {
            var ret = Object.assign({}, e);

            if(!ret.visible) ret.visible = false;
            
            ret[""] = new THREE.LOD();

            lods.forEach(function (ds, i) {
                var mesh = mesh = new THREE.Sprite(new THREE.SpriteMaterial( { 
                    map: new THREE.Texture(new Image()), 
                    color: 0xffffff,
                    transparent: true
                } ));
                
                mesh.visible = ret.visible;

                mesh.material.map.minFilter = THREE.LinearFilter;

                function isPow2(n) {
                        return n && (n & (n - 1)) === 0;
                }

                mesh.material.map.image.onload = function () {
                    mesh.material.map.needsUpdate = true;
                    mesh.scale.set(this.naturalWidth / this.naturalHeight, 1, 1);
                    if(isPow2(this.naturalWidth) && isPow2(this.naturalHeight)) {
                        mesh.material.map.minFilter = THREE.LinearMipmapLinearFilter;
                        console.log(this.naturalWidth, this.naturalHeight)
                    } else {
                        mesh.material.map.minFilter = THREE.LinearFilter;
                    }
                };

                ret[""].addLevel(mesh, ds);
            });
            
            _scene.add(ret[""]);

            ret.needsUpdate = true;

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
                
                if(d.needsUpdate) {
                    d[""].levels.forEach(function(l, i){
                        var o = l.object;
                        o.material.map.image.src =   "data:image/svg+xml;utf8," + encodeURIComponent((d.template || template)(d, i));
                        document.body.appendChild(o.material.map.image)
                    });
                    delete d.needsUpdate;
                };
                
                project(obj, d);
            });

            var old = e.renderer.autoClear;
            e.renderer.autoClear = false;
            e.renderer.render(_scene, e.camera);
            e.renderer.autoClear = old;
        }
    });

    var box = new THREE.Box3();

    function project(obj, d) {
        var m = d[""];
        if(!d.visible || !obj.visible) {
            m.visible = false;
            return;
        }

        m.visible = true;
        
        if(!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
        
        box.copy(obj.geometry.boundingBox);
        box.applyMatrix4(obj.matrixWorld);

        obj.getWorldPosition(d[""].position);

        d[""].position.y = box.max.y + 1;
    }
}