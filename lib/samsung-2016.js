"use strict";

//***
// Based on https://github.com/Badisi/samsung-tv-remote
//

const WebSocket = require('ws');
const base64Encode = function(string) {
    return new Buffer(string).toString('base64');
};


function SamsungTvRemote(config) {
    if( !config.ip ) {
        throw new Error('TV IP address is required');
    }
    config.name = config.name || 'SamsungTvRemote';
    config.mac = config.mac || '00:00:00:00';
    config.port = config.port || 8001;
    config.timeout = config.timeout || 5000;
    
    var self = this;
    this.onError = function (error) {
        console.log('Eroro Samsung Remote Client: ' + error.code);
    };
    
    this.sendKey = this.send = function(key, callback) {
        //if(!key) return;
        
        var url = 'http://' + config.ip + ':' + config.port + '/api/v2/channels/samsung.remote.control?name=' + base64Encode(config.name);
        var ws = new WebSocket(url, function (error) {
            error = error;
        });
        ws.on('error', function (error) {
            self.onError(error);
        });
        
        ws.on('message', function (data, flags) {
            data = JSON.parse(data);
            if( data.event === 'ms.channel.connect' ) {
                
                if (key) { ws.send(
                    JSON.stringify({
                        'method': 'ms.remote.control',
                        'params': {
                            'Cmd': 'Click',
                            'DataOfCmd': key,
                            'Option': 'false',
                            'TypeOfRemote': 'SendRemoteKey'
                        }
                    }),
                    callback
                )} else callback && callback('success');
                
                setTimeout( function () {
                    ws.close();
                }, 1000);
            }
        });
    }
}
    
module.exports = SamsungTvRemote;
