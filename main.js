'use strict';

const { KEY_VOLDOWN, KEY_MUTE } = require('./keys');

//const utils = require(`${__dirname}/lib/utils`);
const utils = require('@iobroker/adapter-core');
const SamsungRemote = require('samsung-remote');
const SamsungHJ = require('./lib/H-and-J-Series-lib/SamsungTv');
const Samsung2016 = require(`${__dirname}/lib/samsung-2016`);
const SamsungTV = require(`${__dirname}/lib/samsungtv/build/device.js`); //custom compiled version of git+https://github.com/luca-saggese/samsungtv.git cause of ES6
const SamsungTvEvents = require('./lib/H-and-J-Series-lib/SamsungTvEvents');
const ping = require(`${__dirname}/lib/ping`);
const Keys = require('./keys');

var remote, remote2016;
var powerOnOffState = 'Power.checkOnOff';
var remoteHJ;
var nodeVersion;
var checkOnOffTimer;
var onOffTimer;

const deviceConfig = {
    ip: null,
    appId: '721b6fce-4ee6-48ba-8045-955a539edadb',
    userId: '654321',
}
var cnt       = 0;        // new 11.2024
var delayTime = 10000;    // new 11.2025
let count     = 0;        // new 11.2024
let powerOn   = false;
let AbortMain = false;
//const delay   = time => new Promise(res=>setTimeout(res,time));  // new 11.2024

// --- Connection control (NEW) ---  //new 1.2026
let Connecting   = false;
let Connected    = false;
let ConnectTimer = null;


//######################################################################################
//
//  S T A R T   A D A P T E R
//
//######################################################################################
var adapter = utils.Adapter({
    name: 'samsung',

    unload: function (callback) {
        try {
            callback();
        } catch (e) {
            callback();
        }
    },
    stateChange: function (id, state) {

        !state.ack ? adapter.log.debug(`stateChange ${id} = ${JSON.stringify(state)}`) : null;
        if (state && !state.ack) {
            var as = id.split('.');
            if (`${as[0]}.${as[1]}` !== adapter.namespace) return;
            switch (as[2]) {
                case 'command':
                    send(state.val, function callback(err) {
                        if (err) {
                        } else {
                        }
                    });
                    break;

                case 'Power':
                    switch (as[3]) {
                        case 'on':
                           onOn(true);
                           return;
                        case 'off':
                            onOn(false);
                            return;
                        case 'checkOnOff':
                        case 'checkOn':
                            checkPowerOnOff();
                            return;
                        default: // let fall through for others
                    }

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
//#############################
        main();
//#############################
    }
});

//#####################################################################################
//
//  F U N C T I O N S
//
//#####################################################################################
//##########   M A I N   ##############################################################
async function main() {
	AbortMain = false;
//########### TYPE 'Samsung2016' ######################################################
    if (adapter.config.apiType === 'Samsung2016') {
        remote2016 = new Samsung2016({ ip: adapter.config.ip, timeout: 2000 });
        remote2016.onError = function (error) {
        }.bind(remote2016);
        try {
            remote2016.send(undefined, function (err, data) {
                if (adapter.config.model2016 === undefined) saveModel2016(err === 'success');
                if (err === 'success' || adapter.config.model2016 === true) {
                    remote = remote2016;
                    remote.powerKey = 'KEY_POWER';
                    Keys.KEY_POWER = Keys.KEY_POWEROFF;
                    delete Keys.KEY_POWEROFF;
                    createObjectsAndStates();
                }
            });
        } catch (err) {
            adapter.log.error(`Connection to TV failed. Is the IP correct? Is the TV switched on? ${err}`);
            adapter.log.error(err.stack);
        }
//########### TYPE 'SamsungTV' ######################################################
    } else if (adapter.config.apiType === 'SamsungTV') {
        var remoteSTV = new SamsungTV(adapter.config.ip, /*adapter.config.token ? undefined : */adapter.config.mac);
        if (adapter.config.token) {
            remoteSTV.token = adapter.config.token;
        }
        try {
            await remoteSTV.connect('ioBroker');
        } catch (err) {
            adapter.log.error(`Connection to TV failed. Is the IP correct? Is the TV switched on? ${err}`);
            return
        }
        if (!adapter.config.token) {
            adapter.log.info('-----------------------------------------');
            adapter.log.info('Confirm on your TV to get a Token');
            adapter.log.info('-----------------------------------------');
            adapter.log.info(`Token: ${remoteSTV.token}`);
            adapter.log.info('-----------------------------------------');
        } else {
            remoteSTV.mac = adapter.config.mac;
        }
        remote = { powerKey: 'KEY_POWER', send: async (cmd, cb) => {
            try {
                await remoteSTV.connect('ioBroker');
                adapter.log.debug(`Status after connect ${remoteSTV.isConnected}`);
            } catch (err) {
                adapter.log.error(`Connection to TV failed. Is the IP correct? Is the TV switched on? ${err}`);
                return
            }
            await remoteSTV.sendKey(cmd);
            cb && cb();
        }};
        createObjectsAndStates();
		
//########### TYPE 'SamsungHJ' ######################################################
    } else if (adapter.config.apiType === 'SamsungHJ') {
		const reachable = await new Promise(res => { 
			ping.probe(adapter.config.ip, { timeout: 2000 }, (err, r) => res(!err && r && r.alive)); 
		}); 
		if (!reachable) { 
			adapter.log.debug('SamsungHJ: TV unreachable → skipping connect attempt'); 
			if (!checkOnOffTimer) { checkPowerOnOff(); }
			return; // WICHTIG: main() NICHT ausführen
		}
							 
        if (adapter.config.ip) {

            adapter.log.debug('Initializing HJ lib');
            deviceConfig.ip = adapter.config.ip;
            remoteHJ = new SamsungHJ(deviceConfig);
			createObjectsAndStates();  // neu 01.2026
			
			// Events kommen über den internen EventEmitter der SamsungTv-Klasse
			remoteHJ.eventEmitter.on(SamsungTvEvents.CONNECTING, () => {
    			adapter.log.debug('Websocket reports CONNECTING');
  			    Connected = true;
			    adapter.setState('info.connected', true, true);
			});

			remoteHJ.eventEmitter.on(SamsungTvEvents.DISCONNECTED, () => {
    			adapter.log.warn('Websocket reports DISCONNECTED');
    			Connected = false;
				AbortMain = true;
    			adapter.setState('info.connected', false, true);

      		// Reconnect starten, aber nur wenn nicht schon versucht wird
    			if (!Connecting && !ConnectTimer) {
        			ConnectTimer = setTimeout(() => {
            			ConnectTimer = null;
            			call_main();
        			}, 5000);
    			}
			});

            try {
                const resp = await remoteHJ.init2();
                adapter.log.info('Connection to TV initialised');

                if (adapter.config.pin) {
                    try {
                        await remoteHJ.confirmPin(adapter.config.pin);
						if (AbortMain) return;
                        await remoteHJ.connect();
						if (AbortMain) return;
                        //createObjectsAndStates(); // // neu 01.2026
							
                        remote = { powerKey: 'KEY_POWERON', 
								   send: (cmd, cb) => {
                                		remoteHJ.sendKey(cmd);
                                		cb && cb();
                        } };
                            
						count = 0;  // reset repeat counter
						Connected = true;
						adapter.setState('info.connected', true, true);
                        adapter.log.info('Successfully connected to your Samsung HJ TV ');
                    } catch (err) {
						Connected = false;
						adapter.setState('info.connected', false, true);
                        adapter.log.error(`Could not connect! Is the Pin correct? ${err.message}`)
                    }

                } else {
                    adapter.log.debug('remoteHJ conf ');
                    adapter.log.debug(remoteHJ.pairing);
                    remoteHJ.requestPin();
                    }
            } catch (err) {
				Connected = false; 
				adapter.setState('info.connected', false, true);
                // try 5x to reconnect, then err
				if( cnt++ > 4 ) {                            // new 11.2024
					adapter.log.warn(`Connection to TV failed. If the TV switched on, is the IP correct?  ${err.message}`)
					adapter.log.debug(err.stack);
				}else {                                      // new 11.2024
					adapter.log.debug('Connection to your Samsung(HJ) TV failed, repeat (' +cnt +')');
					delayTime = adapter.config.delay > 0 ? adapter.config.delay : 10000;  // 11.2025
					if (!Connected && !ConnectTimer) {  //new 1.2026
						ConnectTimer = setTimeout(() => {
							ConnectTimer = null;
							call_main();
						}, delayTime);
					}
				}
            }
        } else {
            adapter.log.error('No IP defined')
        }

    } else {
        try {
            remote = new SamsungRemote({ip: adapter.config.ip});
        } catch (err) {
            adapter.log.error(`Connection to TV failed. Is the IP correct? Is the TV switched on?  ${err.message}`)
            adapter.log.error(err.stack);
            return;
        }
        remote.powerKey = 'KEY_POWEROFF';
        createObjectsAndStates();
		if (!checkOnOffTimer) { checkPowerOnOff(); }
    }
}  //  async function main() {

async function call_main() {
    if (Connecting || Connected) {
        adapter.log.debug('call_main skipped (already connecting/connected)');
        return;
    }
    Connecting = true;
    adapter.log.debug('call_main starting reconnect...');
    try {
        await main();   // WICHTIG: await, damit Fehler gefangen werden
    } catch (err) {
        adapter.log.warn(`Reconnect failed: ${err.message}`);
    } finally {
        Connecting = false;
    }
}

function isOn(callback) {
 //   ping.probe(adapter.config.ip, { timeout: 500 }, function (err, res) {
  ping.probe(adapter.config.ip, { timeout: 2000 }, function (err, res) { // MT 12.2024
        callback(!err && res && res.alive);
    })
}

let lastOn = undefined;

function checkPowerOnOff() {  // new 01.2026
    adapter.log.debug('Checking power on/off state ...');

    if (checkOnOffTimer) clearTimeout(checkOnOffTimer);

    isOn(on => {
        adapter.log.debug(`Power check: on=${on}, lastOn=${lastOn}`);

        if (lastOn !== on) {
            if (on) {
                adapter.setState(powerOnOffState, 'ON', true);
                setStateNe('Power.on', true, true);

                if (on && !Connected && !ConnectTimer) {
                    ConnectTimer = setTimeout(() => {
                        ConnectTimer = null;
                        call_main();
                    }, 5000);
                }
            } else {
                adapter.setState(powerOnOffState, 'OFF', true);
                setStateNe('Power.on', false, true);

                Connected = false;
                adapter.setState('info.connected', false, true);
            }
            lastOn = on;
        }
        // Timer bei nicht connected weiterlaufen lassen
        if (!Connected) checkOnOffTimer = setTimeout(checkPowerOnOff, 15000);
    });
}

//var onOffTimer;
function onOn(val) {
	if (!remoteHJ && adapter.config.apiType === 'SamsungHJ') {
    	adapter.log.debug('SamsungHJ: Ignoring power command because TV is off / not connected');
    	return;
	}

    var timeout = 0, self = this;
    val = !!val;
	
	isOn(function (running) {
        if (!remote) {
            adapter.log.error('Connection to Samsung device not initialized, no command execution possible.');
            return;
        }
        if (running === val) {
            adapter.log.debug(`TV already in state ${val}`);
            adapter.setState('Power.on', val, true);
            return;
        }
        send(remote.powerKey);
        if (onOffTimer) clearTimeout(onOffTimer);
        var cnt = 0;

        function doIt() {
            onOffTimer = null;
            if (cnt++ >= 20) {
                adapter.setState('Power.on', running, true);
                return;
            }
            isOn(function (running) {
                if (running === val) {
                    adapter.setState('Power.on', val, true);
                    return;
                }
                //if (cnt === 1 && val) adapter.setState ('Power.on', running, true);
                onOffTimer = setTimeout(doIt, 1000);
            });
        }
        doIt();
    });
}

function send(command, callback) {
    if (!command) {
        adapter.log.error('Empty commands will not be executed.');
        return;
    }
    if (!remote) {
        adapter.log.error('Connection to Samsung device not initialized, no command execution possible.');
        return;
    }
    adapter.log.debug(`Executing command: ${command}`);
    try {
        remote.send(command, callback || function nop() { });
    } catch (e) {
        adapter.log.error(`Error executing command: ${command}: ${e.message}`);
    }
}

//var nodeVersion;
function minNodeVersion(minVersion) {
    var re = /^v*([0-9]+)\.([0-9]+)\.([0-9]+)/;
    if (nodeVersion === undefined) {
        var nv = re.exec(process.version);
        nodeVersion = nv[1] * 100 * 100 + nv[2] * 100 + nv[3];
    }
    var rv = re.exec(minVersion);
    var mv = rv[1] * 100 * 100 + rv[2] * 100 + rv[3];
    return nodeVersion >= mv;
}

function setStateNe(id, val, ack) {
    adapter.getState(id, function (err, obj) {
        if (obj && (obj.val !== val || obj.ack !== !!ack)) {
            adapter.setState(id, val, !!ack);
        }
    });
}

function createObj(name, val, type, role, desc) {

    if (role === undefined) role = type !== 'channel' ? 'button' : '';
    adapter.setObjectNotExists(name, {
        type: type,
        common: {
            name: name,
            type: 'boolean',
            role: role,
            def: false,
            read: true,
            write: true,
            desc: desc
        },
        native: { command: val }
    }, function (err, obj) {
        if (type !== 'channel') adapter.setState(name, false, true);
    });
}


function saveModel2016(val, callback) {
    adapter.getForeignObject(`system.adapter.${adapter.namespace}`, function (err, obj) {
        if (!err && obj && !obj.native) obj['native'] = {};
        if (obj.native.model2016 === val) return callback && callback();
        obj.native.model2016 = val;
        adapter.config.model2016 = val;
        adapter.setForeignObject(obj._id, obj, {}, function (err, s_obj) {
            callback && callback('changed');
        });
    });
}

function createObjectsAndStates() {
    var commandValues = [];
    var channel;
    for (var key in Keys) {
        if (Keys[key] === null) {
            channel = key;
            createObj(key, '', 'channel');
        }
        else {
            commandValues.push(key);
            createObj(`${channel}.${Keys[key]}`, key, 'state');
        }
    }
    createObj('Power.checkOn', '', 'state', 'state');
    createObj('Power.off', false, 'state', 'state', 'Only if TV is on the power command will be send');
    createObj('Power.on', false, 'state', 'state', 'Indicated power status or turn on if not already turned on');

    adapter.setObjectNotExists('command', {
        type: 'state',
        common: {
            name: 'command',
            type: 'string',
            role: 'state',
            desc: 'KEY_xxx',
            values: commandValues,
            states: commandValues
        },
        native: {
        }
    }, function (err, obj) {
        adapter.setState('command', '', true/*{ ack: true }*/);
    });
    adapter.setObjectNotExists(powerOnOffState, {
        type: 'state',
        common: {
            name: 'Determinant Power state',
            type: 'string',
            role: 'state',
            desc: 'checks if powered or not. Can be set to any value (ack=false). If ack becomes true, val holds the status'
        },
        native: {
            ts: new Date().getTime()
        }
    }, function (err, obj) {
        adapter.setState(powerOnOffState, '', true/*{ ack: true }*/);
        //checkPowerOnOff();
    });
	
	adapter.setObjectNotExists('info.connected', {
    	type: 'state',
    	common: {
        	name: 'Connection status',
        	type: 'boolean',
        	role: 'indicator.connected',
        	read: true,
        	write: false,
        	def: false
    	},
    	native: {}
	}, () => {
    	adapter.setState('info.connected', false, true);
	});
	
    adapter.subscribeStates('*');
}
