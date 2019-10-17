import {THREE} from "../../../dist/three-effects.js";

export default function (renderer, scene, camera, assets) {
    var group = new THREE.Group();

    var material = new THREE.MeshPhysicalMaterial({
        metalness: 0.04,
        roughness: 1,
        aoMapIntensity: 0.24,
        map: assets["venus_diffuse"],
        aoMap: assets["venus_material"],
        roughnessMap: assets["venus_material"],
        //metalnessMap: assets["venus_material"],
        normalMap: assets["venus_normals"],
        side: THREE.FrontSide
    });

    assets["venus_model"].scale(0.05,0.05,0.05);

    var mesh = new THREE.Mesh(assets["venus_model"], material);

    var arr = ["bloom", "outline", "ssao", "outline", "fxaa", "colors", "godrays"];

    arr.forEach(function(s, i){
        var m = new THREE.Mesh(assets["venus_model"], material.clone());
        m.castShadow = true;
        m.receiveShadow = true;
        
        m.material.color.setHSL(i/arr.length, 0.8, 0.66);
        var a = Math.PI * 2 * (i / arr.length);
        m.position.set(Math.sin(a) * 5, 0, Math.cos(a) * 5);
        var r =  (0.4 + i / arr.length);
        m.rotation.y = Math.PI * 2 * Math.round(r * 4) / 4;
        group.add(m);
    })
    
    group.position.y = -0.01;
    return group;
}