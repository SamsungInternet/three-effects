module.exports = function (scene) {

    var ping = [];
    var pong = [];

    var size = new THREE.Vector2(1, 1);

    for(var i = 0; i < 3; i++) {
        ping.push(new WebGLRenderTarget(1,1));
        pong.push(new WebGLRenderTarget(1,1));
    }

    var fn = function (e) {

    };

    scene.addEventListener("afterRender", fn);


    return function () {
        scene.removeEventListener("afterRender", fn);

    }
}