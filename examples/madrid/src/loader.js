import { THREE } from "../../../dist/three-effects.js";
import { OBJLoader } from "./loader/OBJLoader.js";
import { BasisTextureLoader } from "./loader/BasisTextureLoader.js";

var basis_path = './src/loader/';

export default function(renderer, files, progressCb) {
    var handlers = {
        "jpg": THREE.TextureLoader,
        "jpeg": THREE.TextureLoader,
        "png": THREE.TextureLoader,
        "gif": THREE.TextureLoader,
        "basis": BasisTextureLoader,
        "obj": OBJLoader,
        "wav": THREE.AudioLoader,
        "mp3": THREE.AudioLoader,
        "ogg": THREE.AudioLoader
    }

    var assets = {};

    var total = 0, count = 0;

    function handle (cls, file, key) {
        return new Promise(function(resolve){
            var loader = new cls();
            if(cls === BasisTextureLoader) {
                loader.setTranscoderPath( basis_path );
                loader.detectSupport( renderer );
            }
            total++;
            loader.load(file, function ( obj ) {
                    count++;
                    assets[key] = obj.type ==="Group" ? obj.children[0].geometry : obj;
                    progressCb(count/total);
                    resolve();
                },
                undefined,
                function ( err ) {
                    console.error( 'LOAD URL ERROR: ' + file );
                }
            );
        });
        
    }

    var wp = [];

    for( var k in files) {
        var url = files[k];
        var ext = url.split(".").pop().toLowerCase();
        if(ext in handlers) {
            wp.push(handle(handlers[ext], url, k));
        } else {
            console.warn( 'LOAD EXTENSION UNHANDLED: ' + url );
        }
    }

    if(document.fonts) wp.push(document.fonts.ready);

    return Promise.all(wp).then(function () { return assets; });
}