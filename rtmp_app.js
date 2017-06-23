var RtmpStream = require('./rtmp_stream');
var RtmpProtocol = require('./rtmp_protocol').RtmpProtocol;
var RtmpProtocolListener = require('./rtmp_protocol').RtmpProtocolListener;
//app管理模块
//1,连接到App
//2,发布流
//3,播放流

class RtmpApp {
    constructor(appName){
        this.appName = appName;
        this.streams = new Map();
    }

    onConnect(protocolObject, appName) {
        protocolObject.listener.onProtocolPublish = this.onProtocolPublish.bind(this, protocolObject);
    }

    onPublish(streamName){
        var stream = new RtmpStream(streamName);
        this.streams.set(streamName, stream);
        return stream;
    }

    onPlay(player, streamName){
        var stream = this.streams.get(streamName);
        if(stream){
            stream.onPlay(player);
            return true;
        }
        return false;
    }
    
    onUnpublish(streamName){
        var stream = this.streams.get(streamName);
        if(stream){
            this.streams.delete(streamName);
        }
    }
    onProtocolPublish(protocolObject, streamName){
        var stream = this.streams.get(streamName);
        if(!stream){
            stream = new RtmpStream();
        }
        this.streams.set(streamName, stream);
    }
}

module.exports = RtmpApp;