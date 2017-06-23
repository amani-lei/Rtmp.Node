var NET = require('net');
var RtmpProtocol = require('./rtmp_protocol').RtmpProtocol;
var RtmpProtocolListener = require('./rtmp_protocol').RtmpProtocolListener;
var RtmpAppManager = require('./rtmp_app_mananger');

class RtmpServer {
    constructor(){
        this.port = 1935;//rtmp default listent port 1935
        this.net = NET.createServer(this.onClientSocketConnect.bind(this));
        this.appManager = new RtmpAppManager();
        this.clients = new Map();
    }

    start() {
        this.net.listen(this.port, this.onListenListener.bind(this));
    }

    onListenListener(a,b,c,d,e){
        console.log('[server] server listen on port: ' + this.port);
    }

    //io listener
    onClientSocketConnect(socket) {
        socket.on('end', this.onClientSocketEnd.bind(this, socket));
        socket.on('error', this.onClientSocketError.bind(this, socket));
        var protocolObject = new RtmpProtocol(socket, this.appManager);
        this.clients.set(socket, protocolObject);
    }
    onClientSocketEnd(socket){
        this.clients.delete(socket);
    }

    onClientSocketError(socket, error){
        this.clients.delete(socket);
    }
}
module.exports = RtmpServer;