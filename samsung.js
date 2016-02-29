"use strict";

var utils = require(__dirname + '/lib/utils'); 
//var adapter = utils.adapter('samsung');
var Keys = require('./keys');
var SamsungRemote = require('samsung-remote');
var remote;


var adapter = utils.adapter({
    name: 'samsung',

    unload: function (callback) {
        try {
            callback();
        } catch (e) {
            callback();
        }
    },
    discover: function (callback) {
    },
    install: function (callback) {
    },
    uninstall: function (callback) {
    },
    objectChange: function (id, obj) {
    },

    stateChange: function (id, state) {

        if (state && !state.ack) {
            var as = id.split('.');
            if (as[0] + '.' + as[1] != adapter.namespace) return;
            switch (as[2]) {
                case 'command':
                    send(state.val, function callback(err) {
                        if (err) {
                        } else {
                        }
                    });
                    break;

                default:
                    adapter.getObject(id, function (err, obj) {
                        if (!err && obj) {
                            send(obj.native.command, function callback(err) {
                                if (!err) {
                                    adapter.setState(id, false, true);
                                }
                            });
                        }
                    });
                    break;
            }
        }
    },
    ready: function () {
        //g_devices.init(adapter, main);
        main();
    }
});

function send(command, callback) {
    if (!command) {
        adapter.log.error("Empty commands will not be excecuted.");
        return;
    }
    remote.send(command, callback);
}


function createObj(name, val, type) {
    
    adapter.setObjectNotExists(name, {
        type: type,
        common: {
            name: name,
            type: 'boolean',
            role: type !== "channel" ? "button" : "",
            def: false,
            read: true,
            write: true,
            values: [false, true]
        },
        native: { command: val }
    }, "", function (err, obj) {
        if (type !== "channel") adapter.setState(name, false, true);
    });
}


function main() {
    
    var commandValues = [];
    var channel;
    for (var key in Keys) {
        if (Keys[key] === null) {
            channel = key;
            createObj(key, "", "channel");
        }
        else {
            commandValues.push(key);
            createObj(channel + '.' + Keys[key], key, "state");
        }
    }

    remote = new SamsungRemote({ip: adapter.config.IP});

    adapter.setObjectNotExists('command', {
        type: 'state',
        common: {
            name: 'command',
            type: 'string',
            role: 'state',
            desc: "KEY_xxx",
            values: commandValues,
            states: commandValues
        },
        native: {}
    }, "", function (err, obj) {
        adapter.setState("command", "", true/*{ ack: true }*/);
    });

    adapter.subscribeStates('*');
}

