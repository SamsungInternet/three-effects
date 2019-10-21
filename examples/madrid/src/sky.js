import { THREE } from "../../../dist/three-effects.js";

import { Sky } from "./lib/Sky.js";

export default function (renderer, scene, camera, assets) {
    var group = new THREE.Group();

    var mesh = new Sky();

	var light = new THREE.DirectionalLight(new THREE.Color(0xFFFFFF), 1);
	
	light.castShadow = true;

	light.position.set(0, 100, 0);
	
	group.add(light);

	light.shadow.mapSize.width = 1024;  // default
	light.shadow.mapSize.height = 1024; // default
	light.shadow.camera.near = 1;    // default
	light.shadow.camera.far = 200;     // default
	light.shadow.bias = 0.001;
	light.shadow.radius = 4;

	var hemi = new THREE.HemisphereLight(new THREE.Color(0x888899), new THREE.Color(0x776666), 1);

	group.add(hemi);


	var ambient = new THREE.AmbientLight( 0x666666 );
	group.add(ambient);
	group.add(mesh);
	
	mesh.material.uniforms.sunPosition.value = light.position;

	var col = new THREE.Color(0xCC7733);
	
	var a = 1;
	
	scene.fog = new THREE.FogExp2( 0xFFFFFF,0.0066);

	var fn = function () {
		hemi.intensity = 0.1 + a;
		light.intensity = 0.1 +  a;
		ambient.intensity = 0.1 +  a; 

		light.color.set(0xFFFFFF);
		light.color.lerp(col, Math.pow(1 - a, 10) );

		scene.fog.color.copy(light.color).multiplyScalar(0.33);
		scene.userData["bloom_strength"].value = 0.1 + 0.1 * a;
	};

	window.setTimeout(fn,0);

	var vec = new THREE.Vector3();
	
	scene.dispatchEvent({ type:"interact/register", entity: mesh});

	mesh.addEventListener("interact/move", function (e) {
		if(!e.hand.pressed) return;
		var vec = e.hand.raycaster.ray.direction;
		if(vec.y < 0) return;
		light.position.copy(vec).multiplyScalar(100);
		a = vec.y;
		
		fn();
		
		renderer.shadowMap.needsUpdate = true;
	});

    return group;
}