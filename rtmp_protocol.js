var BufferPipe = require('./buffer_pipe');
var RtmpHandshake = require('./rtmp_handshake');
var RtmpChannel = require('./rtmp_channel');
var AMF = require('./rtmp_amf');
var RTMP_INVOKE_TYPE = AMF.RTMP_INVOKE_TYPE;
const RTMP_MESSAGE_TYPE = {
    SET_CHUNK_SIZE:1,
    ABORT: 2,
    ACK: 3,
    USER_CONTROL: 4,
    WINDOW_ACK_SIZE: 5,
    BANDWIDTH: 6,
    EDGE: 7,
    AUDIO: 8,
    VIDEO: 9,
    AMF3_META: 0xF,
    AMF3_SHARD: 0x10,
    AMF3_CMD: 0x11,
    AMF0_META: 0x12,
    AMF0_SHARD: 0x13,
    AMF0_INVOKE: 0x14,
    AGGREGATE: 0x16,
    MAX:0x16,
}

class RtmpProtocolListener {
    constructor(){
    }
    onHandshakeFinish(){

    }

    onProtocolHandshakeFinish(){
    }

    onProtocolSetChunkSize(size) {

    }

    onProtocolWindowAcknowledgementSize (size) {

    }
    onProtocolCreateStream(channelObject) {

    }
    onProtocolReleaseStream(stream) {

    }

    onProtocolFCPublish(stream) {

    }
    
    onProtocolPublish() {
        throw 'must cover this function';
    }
    
    onProtocolSetDataFrame(meta){
        //throw 'must cover this function';
    }
    
    onProtocolAudioData(data){
        throw 'must cover this function';
    }

    onProtocolVideoData(data){
        throw 'must cover this function';
    }

    onProtocolFCUnpublish(stream){

    }
    onProtocolDeleteStream(stream) {
        throw 'must cover this function';
    }
}
class RtmpProtocol {
    constructor(socket,appManager){
        this.inChunkSize = 128;
        this.outChunkSize = 128;
        this.appManager = appManager;
        this.channels = new Map();
        this.socket = socket;
        this.socket.on('data',this.onSocketData.bind(this));
        this.socket.on('error',this.onSocketError.bind(this));

        this.inBuffer = new BufferPipe();
        this.inBuffer.init(this.work());

        this.listener = new RtmpProtocolListener();
    }
    willDistroy(){
        
    }

    onSocketData(data){
        this.inBuffer.push(data);
    }

    onSocketError(error){

    }

    *work() {
        //handshake C0+C1 is 1537 bytes
        console.log('handshake [begin]');
        if(this.inBuffer.need(1537)) yield;
        var readBuffer = this.inBuffer.read(1537);
        this.handleC0C1(readBuffer)
        //C2
        if(this.inBuffer.need(1536)) yield;
        readBuffer = this.inBuffer.read(1536);
        this.handleC2(readBuffer);
        //handshake [ok]
        this.listener.onHandshakeFinish();

        console.log('handshake [ok]');
        var lastMessage = null;
        
        while(true) {
            var message = {};
            var error = false;
            if(this.inBuffer.need(1)) yield;
            readBuffer = this.inBuffer.read(1);

            message.headFmt = readBuffer[0] >> 6;
            message.csid = readBuffer[0] & 0x3F;
            //one byte csid
            if(message.csid == 0) {
                if(this.inBuffer.need(1)) yield;
                readBuffer = this.inBuffer.read(1);
                message.csid = 64 + readBuffer[0];
            }else if(message.csid == 1) {
                //two bytes csid
                if(this.inBuffer.need(2)) yield;
                
                readBuffer = this.inBuffer.read(2);
                message.csid = 64 + readBuffer[0] + (readBuffer[1] << 8);
            }
            //12byts head
            if(message.headFmt == 0) {
                if(this.inBuffer.need(11)) yield;
                
                readBuffer = this.inBuffer.read(11);
                var timestamp = readBuffer.readUIntBE(0, 3);

                message.bodySize = readBuffer.readUIntBE(3, 3);
                message.typeId = readBuffer[6];
                message.streamId = readBuffer.readUIntLE(7,4);
                if(timestamp == 0xFFFFFF){
                    if(this.inBuffer.need(4)) yield;
                    var timestampExBuffer = this.inBuffer.read(4);
                    timestamp = timestampExBuffer.readUIntBE(0,4);
                }
                message.timestamp = timestamp;
            }else if(message.headFmt == 1) {
                //8bytes head
                //3bytes timestamp
                //3bytes bodysize
                //1byte  typeid
                if(this.inBuffer.need(7)) yield;
                
                readBuffer = this.inBuffer.read(7);
                var timestamp = readBuffer.readUIntBE(0, 3);
                if(timestamp == 0xFFFFFF){
                    if(this.inBuffer.need(4)) yield;
                    var timestampExBuffer = this.inBuffer.read(4);
                    timestamp = timestampExBuffer.readUIntBE(0,4);
                    message.timestampDelta = 0;
                    message.timestamp = timestamp;
                }else{
                    message.timestampDelta = timestamp;
                    message.timestamp = lastMessage == null ? timestamp : timestamp + lastMessage.timestamp;
                }
                
                message.bodySize = readBuffer.readUIntBE(3, 3);
                message.typeId = readBuffer[6];
                message.streamId = lastMessage == null ? 0 : lastMessage.streamId;
            }else if(message.headFmt == 2) {
                //4bytes head
                if(this.inBuffer.need(3)) yield;
                
                readBuffer = this.inBuffer.read(3); 
                var timestamp = readBuffer.readUIntBE(0, 3);
                if(timestamp == 0xFFFFFF){
                    if(this.inBuffer.need(4)) yield;
                    var timestampExBuffer = this.inBuffer.read(4);
                    timestamp = timestampExBuffer.readUIntBE(0,4);
                    message.timestampDelta = 0;
                    message.timestamp = timestamp;
                }else{
                    message.timestampDelta = timestamp;
                    message.timestamp = lastMessage == null ? timestamp : timestamp + lastMessage.timestamp;
                }
                if(lastMessage == null) {
                    console.log('connect Chunk Format Error');
                    continue;
                } else {
                    message.bodySize = lastMessage.bodySize;
                    message.typeId = lastMessage.typeId;
                    message.streamId = lastMessage.streamId;
                }
            }else if(message.headFmt == 3) {
                if(lastMessage){
                    message.headFmt = lastMessage.headFmt;
                    message.csid = lastMessage.csid;
                    message.bodySize = lastMessage.bodySize;
                    message.typeId = lastMessage.typeId;
                    message.streamId = lastMessage.streamId;
                    message.timestampDelta = lastMessage.timestampDelta;
                    if(lastMessage.headFmt != 0){
                        message.timestamp = lastMessage.timestamp + lastMessage.timestampDelta;
                    }else{
                        message.timestamp = lastMessage.timestamp;
                    }
                }else{
                    continue;
                }
            } else {
                console.log('[protocol] unknow Header format:',headFmt);
                continue;
            }
            //console.log('[protocol] recive message length:',message.bodySize);
            var messageLength = message.bodySize;
            var payloadLength = 0;
            //chunk count
            var chunkCount = message.bodySize / this.inChunkSize + (message.bodySize % this.inChunkSize == 0 ? 0:1);
            var bodyBuffer = [];
            var readLength = 0;
            while(readLength< message.bodySize){
                if(message.bodySize - readLength > this.inChunkSize){
                    if(this.inBuffer.need(this.inChunkSize)) yield;
                    readBuffer = this.inBuffer.read(this.inChunkSize);
                    readLength += this.inChunkSize;
                    bodyBuffer.push(readBuffer.slice(0));
                    //read 1byte head
                    if(this.inBuffer.need(1)) yield;
                    readBuffer = this.inBuffer.read(1);
                    if((readBuffer[0] >> 6) != 0x3){
                        //error
                        error = true;
                        break;
                    }
                }else {
                    if(this.inBuffer.need(message.bodySize - readLength)) yield;
                    readBuffer = this.inBuffer.read(message.bodySize - readLength);
                    readLength = message.bodySize;
                    bodyBuffer.push(readBuffer.slice(0));
                    break;
                }
            }
            if(!error){
                //console.log('[protocol] parser');
                message.body = Buffer.concat(bodyBuffer);
                this.parserMessageBody(message);

                lastMessage = message;
            }else {
                console.log('[protocol] error');
            }
            //end of while
        }
    }
    handleC0C1(c0c1){
        var s0s1s2 = RtmpHandshake.GenerateHandshakeS0S1S2(c0c1);
        this.socket.write(s0s1s2);
    }
    handleC2(c2) {
        
    }
    parserMessageBody(message) {
        //console.log('[protocol] message.body.length = ' + message.body.length);
        switch(message.typeId){
            case RTMP_MESSAGE_TYPE.SET_CHUNK_SIZE://set chunk size
                var chunkSize = message.body.readUIntBE(0,4);
                if(chunkSize <= 65536 && chunkSize >= 128){
                    this.inChunkSize = chunkSize;
                }
                else{
                    console.log('[protocol] unsupport chunk size:',chunkSize);
                }
                break;
            // case 0x02://abort message

            //     break;
            // case 0x03://acknowledeg
            //     break;
            case RTMP_MESSAGE_TYPE.USER_CONTROL://USER_CONTROL
                this.parserUserControlMessage(message);
                break;
            case RTMP_MESSAGE_TYPE.WINDOW_ACK_SIZE://window acknowledeg
                //this.parserWindowAckSize(message);
                break;
            case RTMP_MESSAGE_TYPE.BANDWIDTH://set peer bandwidth
                break;
            // case 0x07:
            //     break;
            case RTMP_MESSAGE_TYPE.AUDIO://audio
                var channel = this.channels.get(message.streamId);
                if(channel){
                    channel.onAudioData(message.timestamp, message.body);
                }
                break;
            case RTMP_MESSAGE_TYPE.VIDEO://video
                var channel = this.channels.get(message.streamId);
                if(channel){
                    channel.onVideoData(message.timestamp, message.body);
                }
                break;
            // case 0x0A-0x11:
            //     break;
            // case RTMP_MESSAGE_TYPE.AMF3_META://notify
            //     break;
            // case RTMP_MESSAGE_TYPE.AMF3_SHARD://share object
            //     break;
            // case RTMP_MESSAGE_TYPE.AMF3_CMD://invoke AFM0
            //     break;
            case RTMP_MESSAGE_TYPE.AMF0_META://notify
                this.parserAmf0MetaMessage(message);
                break;
            // case RTMP_MESSAGE_TYPE.AMF0_SHARD://share object
            //     break;
            case RTMP_MESSAGE_TYPE.AMF0_INVOKE://invoke AFM0
                var invoke =  this.parserAmf0InvokeMessage(message);
                break;
            default:
                console.log('[protocol] unknow chunk type id:', message.typeId);
                break;
        }
    }

    parserUserControlMessage(message) {
        var eventType = message.body.readUInt16BE(0);
        message.userCtrl = {};
        message.userCtrl.eventType = eventType;
        if(eventType == 3) {//only 3(set buffer length) in server
            message.userCtrl.streamId = message.body.readUInt32BE(2);
            message.userCtrl.delay = message.body.readUInt32BE(6);
        }
    }

    parserAmf0InvokeMessage(message) {
        var invoke = AMF.amfDecInvoke(message.body);
        if(!invoke){
            console.log('[protocol] dec invoke error: return null');
            return;
        }
        console.log(invoke.cmdName);
        if(invoke.cmdName == RTMP_INVOKE_TYPE.CONNECT){
            this.sendSetChunkSize();
            this.sendWindowAcknowledgementSize();
            var result = AMF.amfEncConnectResult(invoke);
            this.appName = invoke.cmdObject['app'];
            this.respondConnect(result);
        } else if(invoke.cmdName == RTMP_INVOKE_TYPE.CREATE_STREAM){
            //create channel
            if(this.appName){
                //get app
                var app = this.appManager.getApp(this.appName);
                if(app){
                    //create channel and to channels
                    var channelObject = new RtmpChannel(1,app);
                    channelObject.listener.respondPublish = this.respondPublish.bind(this);
                    channelObject.listener.respondPlay = this.respondPlay.bind(this);
                    channelObject.listener.sendSampleAccess = this.sendSampleAccess.bind(this);
                    channelObject.listener.sendStreamBegin = this.sendStreamBegin.bind(this);
                    channelObject.listener.sendMetaData = this.sendMetaData.bind(this);
                    channelObject.listener.sendAudioSequenceHeader = this.sendAudioSequenceHeader.bind(this);
                    channelObject.listener.sendVideoSequenceHeader = this.sendVideoSequenceHeader.bind(this);
                    channelObject.listener.sendAudioData = this.sendAudioData.bind(this);
                    channelObject.listener.sendVideoData = this.sendVideoData.bind(this);
                    channelObject.listener.sendStreamEof = this.sendStreamEof.bind(this);
                    
                    
                    this.channels.set(1, channelObject);
                }
                var result = AMF.amfEncCreateStreamResult(invoke, channelObject.channelId);
                this.respondCreateStream(result);
            }
        } else if(invoke.cmdName == RTMP_INVOKE_TYPE.PUBLISH){
            //find channel from channles with streamid
            var channel = this.channels.get(message.streamId);
            if(channel){
                channel.onPublish(invoke.streamName);
            }
        } else if (invoke.cmdName == RTMP_INVOKE_TYPE.FCUNPUBLISH) {
            //nothing to do
        } else if(invoke.cmdName == RTMP_INVOKE_TYPE.DELEATE_STREAM){
            var channel = this.channels.get(message.streamId);
            if(channel){
                channel.onDeleteStream();
                var result = AMF.amfEncDeleteStreamResult();
                this.respondDeleteStream(result);
                this.channels.delete(message.streamId);
            }
        }else if(invoke.cmdName == RTMP_INVOKE_TYPE.RELEASE_STREAM){

        }else if(invoke.cmdName == RTMP_INVOKE_TYPE.PLAY) {
            var channel = this.channels.get(message.streamId);
            if(channel){
                channel.onPlay(invoke.streamName);
            }
        }
        return invoke;
    }

    parserAmf0MetaMessage(message) {
        //var meta = AMF.amfDecMetaData(message.body);
        if(message.streamId != 0){
            var channel = this.channels.get(message.streamId);
            if(channel){
                channel.onSetDataFrame(message.body);
            }
        }
    }
    sendMessage (message) {
        var sendBuffer = null;
        var sendLength = 0;
        if(message.bodySize > this.outChunkSize) {
            sendBuffer = Buffer.alloc(12 + this.outChunkSize, 0);
            sendBuffer[0] = (message.headFmt << 6) | message.csid;
            sendBuffer.writeUIntBE(message.timestamp, 1, 3);
            sendBuffer.writeUIntBE(message.bodySize, 4, 3);
            sendBuffer[7] = message.typeId;;
            sendBuffer.writeUInt32LE(message.streamId, 8);
            message.body.copy(sendBuffer,12, 0, this.outChunkSize);
            this.socket.write(sendBuffer);
            sendLength += this.outChunkSize;
            while(sendLength < message.bodySize){
                var onceLength = (message.bodySize - sendLength > this.outChunkSize) ? this.outChunkSize : message.bodySize - sendLength;
                var buffer = Buffer.alloc(1 + onceLength, 0);
                buffer[0] = 0xC0 | message.csid;
                message.body.copy(buffer,1, sendLength, sendLength + onceLength);
                this.socket.write(buffer);
                sendLength += onceLength;
            }
        }else {
            sendBuffer = Buffer.alloc(12 + message.bodySize, 0);
            sendBuffer[0] = (message.headFmt << 6) | message.csid;
            sendBuffer.writeUIntBE(message.timestamp, 1, 3);
            sendBuffer.writeUIntBE(message.bodySize, 4, 3);
            sendBuffer.writeUInt8(message.typeId, 7);
            sendBuffer.writeUInt32LE(message.streamId, 8);
            message.body.copy(sendBuffer, 12);
            this.socket.write(sendBuffer);
        }
    }
    sendSampleAccess(channelId) {
        var message = {};
        message.headFmt = 0x00;
        message.csid = 0x04;
        message.timestamp = 0;
        message.typeId = RTMP_MESSAGE_TYPE.AMF0_META;
        message.streamId = channelId;
        message.body = AMF.amfEncSampleAccess();
        message.bodySize = message.body.length;
        this.sendMessage(message);
    }
    sendStreamBegin(channelId){
        var message = {};
        message.headFmt = 0x00;
        message.csid = 0x02;
        message.timestamp = 0;
        message.typeId = RTMP_MESSAGE_TYPE.USER_CONTROL;
        message.streamId = 0;
        message.bodySize = 6;
        message.body = Buffer.alloc(6,0);
        message.body.writeUInt32BE(channelId, 2);
        this.sendMessage(message);
    }
    
    sendMetaData(channelId, meta){
        var message = {};
        message.headFmt = 0x00;
        message.csid = 0x04;
        message.timestamp = 0;
        message.typeId = RTMP_MESSAGE_TYPE.AMF0_META;
        message.streamId = channelId;
        message.bodySize = meta.length;
        message.body = meta;
        this.sendMessage(message);
    }

    sendAudioSequenceHeader(channelId, timestamp, squenceHeader){
        var message = {};
        message.headFmt = 0x00;
        message.csid = 0x04;
        message.timestamp = timestamp;
        message.typeId = RTMP_MESSAGE_TYPE.AUDIO;
        message.streamId = channelId;
        message.bodySize = squenceHeader.length;
        message.body = squenceHeader;
        this.sendMessage(message);
    }

    sendVideoSequenceHeader(channelId, timestamp, squenceHeader){
        var message = {};
        message.headFmt = 0x00;
        message.csid = 0x04;
        message.timestamp = timestamp;
        message.typeId = RTMP_MESSAGE_TYPE.VIDEO;
        message.streamId = channelId;
        message.bodySize = squenceHeader.length;
        message.body = squenceHeader;
        this.sendMessage(message);
    }

    sendAudioData(channelId, timestamp, audioData){
        var message = {};
        message.headFmt = 0x00;
        message.csid = 0x04;
        message.timestamp = timestamp;
        message.typeId = RTMP_MESSAGE_TYPE.AUDIO;
        message.streamId = channelId;
        message.bodySize = audioData.length;
        message.body = audioData;
        this.sendMessage(message);
    }

    sendVideoData(channelId, timestamp, videoData){
        var message = {};
        message.headFmt = 0x00;
        message.csid = 0x04;
        message.timestamp = timestamp;
        message.typeId = RTMP_MESSAGE_TYPE.VIDEO;
        message.streamId = channelId;
        message.bodySize = videoData.length;
        message.body = videoData;
        this.sendMessage(message);
    }
    sendStreamEof (channelId) {
        var message = {};
        message.headFmt = 0x00;
        message.csid = 0x02;
        message.timestamp = 0;
        message.typeId = RTMP_MESSAGE_TYPE.USER_CONTROL;
        message.streamId = 0;
        message.bodySize = 6;
        message.body = resultData;
        this.sendMessage(message);
    }

    sendSetChunkSize() {
        var message = {};
        message.headFmt = 0x00;
        message.csid = 0x02;
        message.timestamp = 0;
        message.typeId = RTMP_MESSAGE_TYPE.SET_CHUNK_SIZE;
        message.streamId = 0;
        message.bodySize = 4;
        message.body = new Buffer(4);
        message.body.writeUIntBE(this.outChunkSize,0,4);
        this.sendMessage(message);
    }
    sendWindowAcknowledgementSize() {
        var message = {};
        message.headFmt = 0x00;
        message.csid = 0x02;
        message.timestamp = 0;
        message.typeId = RTMP_MESSAGE_TYPE.WINDOW_ACK_SIZE;
        message.streamId = 0;
        message.bodySize = 4;
        message.body = new Buffer(4);
        message.body.writeUIntBE(5000000,0,4);
        this.sendMessage(message);
    }
    
    respondConnect (resultData) {
        var message = {};
        message.headFmt = 0x00;
        message.csid = 0x03;
        message.timestamp = 0;
        message.typeId = RTMP_MESSAGE_TYPE.AMF0_INVOKE
        message.streamId = 0;
        message.bodySize = resultData.length;
        message.body = resultData;
        this.sendMessage(message);
    }

    respondCreateStream (resultData) {
        var message = {};
        message.headFmt = 0x00;
        message.csid = 0x03;
        message.timestamp = 0;
        message.typeId = RTMP_MESSAGE_TYPE.AMF0_INVOKE;;
        message.streamId = 0;
        message.bodySize = resultData.length;
        message.body = resultData;
        this.sendMessage(message);
    }  
    
    respondPublish (channelId, resultData) {
        var message = {};
        message.headFmt = 0x00;
        message.csid = 0x03;
        message.timestamp = 0;
        message.typeId = RTMP_MESSAGE_TYPE.AMF0_INVOKE;
        message.streamId = 0;
        message.bodySize = resultData.length;
        message.body = resultData;
        this.sendMessage(message);
    } 

    respondDeleteStream (resultData) {
        var message = {};
        message.headFmt = 0x00;
        message.csid = 0x03;
        message.timestamp = 0;
        message.typeId = RTMP_MESSAGE_TYPE.AMF0_INVOKE;
        message.streamId = 0;
        message.bodySize = resultData.length;
        message.body = resultData;
        this.sendMessage(message);
    } 
    
    respondPlay (channelId, resultData) {
        var message = {};
        message.headFmt = 0x00;
        message.csid = 0x02;
        message.timestamp = 0;
        message.typeId = RTMP_MESSAGE_TYPE.AMF0_INVOKE;
        message.streamId = channelId;
        message.bodySize = resultData.length;
        message.body = resultData;
        this.sendMessage(message);
    }  
}



module.exports = {
    RtmpProtocolListener:RtmpProtocolListener,
    RtmpProtocol:RtmpProtocol,
}