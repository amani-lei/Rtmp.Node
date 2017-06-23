var RtmpProtocol = require('./rtmp_protocol').RtmpProtocol;
var RtmpProtocolListener = require('./rtmp_protocol').RtmpProtocolListener;

class RtmpStreamListener{
    sendDataFrame(){
        throw 'must cover this function';
    }
    sendVideoData(){
        throw 'must cover this function';
    }
    sendVideoData(){
        throw 'must cover this function';
    }
}

class RtmpStream{
    constructor(streamName){
        this.listener = new RtmpStreamListener();
        this.streamName = streamName;
        this.metaData = null;
        this.audioSquenceHeader = null;
        this.videoSquenceHeader = null;
        this.gopCache = new Array();
        this.playerChannels = new Array();//channelobject
    }

    onMetaData(metaData) {
        this.metaData = new Buffer(metaData);
        this.playerChannels.forEach(function(channel) {
            channel.sendMetaData(metaData);
        }, this);
    }

    onAudioData(timestamp, data) {
        if(data[1] == 0){
            this.audioSquenceHeader = {timestamp:timestamp,data: new Buffer(data.length)};
        }

        this.playerChannels.forEach(function(channel) {
            channel.sendAudioData(timestamp, data);
        }, this);
    }

    onVideoData(timestamp, data) {
        //squence header
        if(data[0] == 0x17 ){
            if(data[1] == 0x00){
                this.videoSquenceHeader = {timestamp:timestamp,data: new Buffer(data.length)};
                data.copy(this.videoSquenceHeader.data);
            }else{
                this.gopCache = [];
                var cache = {};
                cache.timestamp = timestamp;
                cache.data = data;
                this.gopCache.push(cache);
            }
        }else if(data[0] == 0x27){
            var cache = {};
            cache.timestamp = timestamp;
            cache.data = data;
            this.gopCache.push(cache);
        }

        this.playerChannels.forEach(function(channel) {
            channel.sendVideoData(timestamp, data);
        }, this);
    }

    onDeleteStream(){
        if(this.players){
            this.playerChannels.forEach(function(channel) {
                channel.sendStreamEof();
            }, this);
        }

        this.listener = null;
        this.streamName = null;
        this.metaData = null;
        this.audioSquenceHeader = null;
        this.videoSquenceHeader = null;
        this.gopCache = null;
        this.playerChannels = null;//channelobject
    }
    onPlay(channel){
        //
        if(!(this.metaData && (this.videoSquenceHeader || this.audioSquenceHeader))){
            return false;
        }
        var is = false;
        try{
            this.playerChannels.forEach(function(p) {
                if(p === channel){
                    is = true;
                    throw 'break';
                }
            }, this);
        }
        catch(e){

        }
        this.playerChannels.push(channel);
        if(!is){
            channel.respondPlay();
            channel.sendStreamBegin();
            channel.sendMetaData(this.metaData);
            if(this.audioSquenceHeader)
            channel.sendAudioSequenceHeader(this.audioSquenceHeader.timestamp, this.audioSquenceHeader.data);
            if(this.videoSquenceHeader)
            channel.sendVideoSequenceHeader(this.videoSquenceHeader.timestamp, this.videoSquenceHeader.data);
                 
            this.gopCache.forEach(function(data) {
                channel.sendVideoData(data.timestamp, data.data);
            }, this);
        }
        return true;
    }
}

module.exports = RtmpStream;