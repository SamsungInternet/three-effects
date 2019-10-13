/* 
* Copyright (c) 2016-2018, Yannis Gravezas 
* Copyright (c) 2019 Samsung Internet
* Available under the MIT license.
*/

export default function (obj, name, api) {
  
    var objects = [];

    var listeners = {};

    for (var k in api) {
        var lname, fn;
        switch(k) {
            case "init": 
                lname = name + "/register";
                fn = function(e) {
                    var index = objects.indexOf(e.entity);
                    if( index !== -1) {
                        if(e.keep) return;
                        objects.splice(index, 1);
                        if (api.remove) api.remove(e, objects, name);
                        delete e.entity.userdata[name];
                    }
                    objects.push(e.entity);
                    e.entity.userData[name] = api.init(e, objects, name, e.reset);
                };
                break;
            
            case "remove": 
                lname = name + "/unregister";
                fn = function(e) { 
                    var index = objects.indexOf(e.entity);
                    if(index !== -1) {
                        objects.splice(index, 1);
                        if (api.remove) api.remove(e, objects, name);
                        delete e.entity.userdata[name];
                    }
                };
                break;
            
            case "control": continue;
            
            default:
                lname = k;
                fn = function (ev) {
                    api[k].call(ev, objects, name);
                };
        }
        listeners[lname] = fn;
        obj.addEventListener(lname, fn);
    }

    return function (arg) {
        if(!arg) {
            objects.forEach( function (obj) {
                if (api.remove) api.remove({ entity: obj }, objects, name);
                delete e.entity.userdata[name];
            });
            for(var k in listeners) {
                obj.removeEventListener(k, listeners[k]);
            }
        } else if (api.control) {
            api.control(arg, objects, name);
        }
    }
}