import {THREE} from "../../../dist/three-effects.js";

export default function (renderer, scene, camera, assets) {
    var group = new THREE.Group();

    var material = new THREE.MeshStandardMaterial({
        metalness: 0,
        roughness: 1,
        aoMapIntensity: 0.5,
        map: assets["venus_diffuse"],
        aoMap: assets["venus_material"],
        roughnessMap: assets["venus_material"],
        normalMap: assets["venus_normals"]
    });

    assets["venus_model"].scale(0.05,0.05,0.05);
    assets["venus_model"].computeBoundingBox();

    var arr = ["bloom", "outline", "ssao", "filmgrain", "!fxaa", "colors", "godrays", "!glitch"];

    arr.forEach(function(s, i){
        var m = new THREE.Mesh(assets["venus_model"], material.clone());
        m.castShadow = true;
        m.receiveShadow = true;
        
        m.material.color.setHSL(i/arr.length, 0.2, 0.7);

        var a = Math.PI * 2 * (i / arr.length);
        m.position.set(Math.sin(a) * 5, 0, Math.cos(a) * 5);
    
        var r =  (0.4 + i / arr.length);
        m.rotation.y = Math.PI * 2 * Math.round(r * 4) / 4;
        
        group.add(m);

        scene.dispatchEvent({ type: "interact/register", entity: m});
        
        m.addEventListener("interact/enter",function () {
            m.material.emissive.set(0x111111);
            scene.dispatchEvent({ type: "audio/tick" });
            m.userData.label.visible = true;
        });

        m.addEventListener("interact/leave",function () {
            m.material.emissive.set(0x000000);
            m.userData.label.visible = false;
        });

        var ev = {type: "option", name: s, value: false};
       
        var isActive = false;
    
        m.material.color.setHSL(i / arr.length, isActive ? 0.8 : 0.2, isActive ? 0.8 : 0.7);
            
        m.addEventListener("interact/press",function () {
            isActive = !isActive;
            m.material.color.setHSL(i / arr.length, isActive ? 0.8 : 0.2, isActive ? 0.8 : 0.7);
            ev.value = isActive;
            scene.dispatchEvent(ev);
            scene.dispatchEvent({ type: "audio/zit" });
            m.userData.label.text = s.replace("!", "") + (isActive ? " on" : " off");
            m.userData.label.disabled = !isActive;
            m.userData.label.needsUpdate = true;
        });

        scene.dispatchEvent(ev);

        scene.dispatchEvent({ type: "label/register", visible: false, entity: m, text: s.replace("!", "") + " off", scale: 0.33, disabled: !isActive});
    })
    
    group.position.y = -0.01;
    return group;
}