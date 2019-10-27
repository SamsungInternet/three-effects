import { THREE } from "../../../dist/three-effects.js";

import { Sky } from "./lib/Sky.js";

export default function (renderer, scene, camera, assets) {
    var group = new THREE.Group();

	var _scene = new THREE.Scene();

    var mesh = new Sky();

	var cubeCamera = new THREE.CubeCamera( 1, 100000, 128 );
	
	_scene.add( cubeCamera );

	_scene.add( mesh );

	var shader = THREE.ShaderLib[ "cube" ];
	shader.uniforms[ "tCube" ].value = cubeCamera.renderTarget.texture;

	var material = new THREE.ShaderMaterial( {

		fragmentShader: shader.fragmentShader,
		vertexShader: shader.vertexShader,
		uniforms: shader.uniforms,
		depthWrite: false,
		side: THREE.BackSide

	});

	var skybox = new THREE.Mesh( new THREE.BoxBufferGeometry( 1000, 1000, 1000 ), material );

	group.add(skybox);

	var light = new THREE.DirectionalLight(new THREE.Color(0xFFFFFF), 1);
	
	light.castShadow = true;

	light.position.set(50, 100, 20).normalize();
	
	group.add(light);


	var isHD = document.location.hash === "#hd";

	light.shadow.mapSize.width = isHD ? 4096 : 2048;
	light.shadow.mapSize.height = isHD ? 4096 : 2048; 
	light.shadow.type = isHD ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
	light.shadow.camera.near = 1;    
	light.shadow.camera.far = 200;    
	light.shadow.camera.left = -50;   
	light.shadow.camera.top = 50;     
	light.shadow.camera.right = 50;    
	light.shadow.camera.bottom = -50;
	light.shadow.bias = 0.00001;
	light.shadow.radius = 1;

	var hemi = new THREE.HemisphereLight(new THREE.Color(0x888899), new THREE.Color(0x776666), 1);

	group.add(hemi);


	var ambient = new THREE.AmbientLight( 0x666666 );
	group.add(ambient);
	
	mesh.material.uniforms.sunPosition.value = light.position;

	var col = new THREE.Color(0xCC7733);
	
	var a = 1;
	
	scene.fog = new THREE.FogExp2( 0xFFFFFF,0.0066);

	var needsUpdate = false;

	var fn = function () {
		hemi.intensity = 0.1 + a;
		light.intensity = 0.1 +  a;
		ambient.intensity = 0.1 +  a; 

		light.color.set(0xFFFFFF);
		light.color.lerp(col, Math.pow(1 - a, 10) );

		scene.fog.color.copy(light.color).multiplyScalar(0.33);
		scene.userData["bloom_strength"].value = 0.1 + 0.1 * a;
		
		needsUpdate = true;

		var vrEnabled = renderer.vr.enabled;

		renderer.vr.enabled = false;

		//cubeCamera.update( renderer, _scene );

		renderer.vr.enabled = vrEnabled;

		
		renderer.shadowMap.needsUpdate = true;
	};

	scene.addEventListener("afterRender", function () {
		
		if(needsUpdate) { 
		
			cubeCamera.update( renderer, _scene );

			needsUpdate = false;
		
		}

	});

	window.setTimeout(fn,0);

	scene.dispatchEvent({ type:"interact/register", entity: skybox});

	skybox.addEventListener("interact/move", function (e) {
		if(!e.hand.pressed) return;
		var vec = e.hand.raycaster.ray.direction;
		if(vec.y < 0) return;
		light.position.copy(vec).multiplyScalar(100);
		a = vec.y;
		
		fn();
		
	});

    return group;
}