import {THREE} from "../../../dist/three-effects.js";

export default function (renderer, scene, camera, assets) {
    var group = new THREE.Group();

    var material = new THREE.MeshStandardMaterial({
        //metalness: 1,
        roughness: 0,
        aoMapIntensity: 1,
        aoMap: assets["ground_material"],
        map: assets["ground_diffuse"],
        roughnessMap: assets["ground_material"],
        //metalnessMap: assets["ground_material"],
        normalMap: assets["ground_normals"]
    });

    (["map", "roughnessMap", "normalMap", "metalnessMap", "aoMap"]).forEach(function(k){
        if(!material[k]) return;
        material[k].wrapS = THREE.RepeatWrapping;
        material[k].wrapT = THREE.RepeatWrapping;
        material[k].anisotropy = 4;
        material[k].repeat.set(333, 333);
    });
    
    console.log(material)
    var mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(1000,1000), material);

    mesh.receiveShadow = true;

    mesh.rotation.x = -Math.PI / 2;
    //mesh.position.y = -1;
    //mesh.visible = false;

    group.add(mesh);

    return group;
}