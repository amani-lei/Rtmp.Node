var RtmpProtocl = require('./rtmp_protocol');
var RtmpStream = require('./rtmp_stream');
var AMF = require('./rtmp_amf');
class RtmpChannelListener {
    respondPublish(channelId, result){
        throw 'must cover this function';
    }
    respondPlay(channelId, result){
        throw 'must cover this function';
    }
    sendSampleAccess(channelId) {
        throw 'must cover this function';
    }
    sendMetaData(channelId, metaData){
        throw 'must cover this function';
    }
    sendAudioSequenceHeader(channelId, timestamp, squence){
        throw 'must cover this function';
    }
    sendVideoSequenceHeader(channelId, timestamp, squence){
        throw 'must cover this function';
    }
    sendAudioData(channelId, timestamp, audioData){
        throw 'must cover this function';
    }
    sendVideoData(channelId, timestamp, videoData){
        throw 'must cover this function';
    }
    sendStreamEof(channelId){
        throw 'must cover this function';
    }
}

class RtmpChannel{
    constructor(channelId, app){
        this.channelId = channelId;
        this.app = app;
        this.listener = new RtmpChannelListener();
        this.stream = null;//only publish
    }
    
    onPublish(streamName){
        this.stream = this.app.onPublish(streamName);
        var result = AMF.amfEncPublishResult();
        this.listener.respondPublish(this.channelId, result);
    }

    onSetDataFrame(metaData){
        if(this.stream){
            var type = metaData[0];
            if(type != AMF.RTMP_AFM0_TYPE.TYPE_STRING){
                console.log('[channel] metaData error');
            }
            var r = AMF.amfDecString(metaData.slice(1));
            this.stream.onMetaData(metaData.slice(1 + r.length));
        }
    }

    onAudioData(timestamp, data){
        if(this.stream){
            this.stream.onAudioData(timestamp, data);
        }
    }

    onVideoData(timestamp, data){
        if(this.stream){
            this.stream.onVideoData(timestamp, data);
        }
    }
    onDeleteStream(){
        if(this.stream){
            this.app.onUnpublish(this.stream.streamName);
            this.stream.onDeleteStream();
            this.stream = null;
            this.app = null;
            this.listener = null;
        }
    }
    onPlay(streamName){
        if(!this.app.onPlay(this, streamName)){
            this.respondPlay(false);
        }
    }
    sendStreamBegin(){
        this.listener.sendStreamBegin(this.channelId);
    }
    sendMetaData(metaData){
        this.listener.sendMetaData(this.channelId, metaData);
    }
    sendVideoSequenceHeader(timestamp, squenceHeader){
        this.listener.sendVideoSequenceHeader(this.channelId, timestamp, squenceHeader);
    }
    sendAudioSequenceHeader(timestamp, squenceHeader){
        this.listener.sendAudioSequenceHeader(this.channelId, timestamp, squenceHeader);
    }
    sendAudioData(timestamp, audioData){
        this.listener.sendAudioData(this.channelId, timestamp, audioData);
    }
    sendVideoData(timestamp, videoData){
        this.listener.sendVideoData(this.channelId, timestamp, videoData);
    }
    sendStreamEof(){
        this.listener.sendStreamEof(this.channelId);
    }
    respondPlay(success = true){
        this.listener.respondPlay(this.channelId, AMF.amfEncPlayResult(success));
        if(success){
            this.listener.sendSampleAccess(this.channelId);
        }
    }
}
module.exports = RtmpChannel;
