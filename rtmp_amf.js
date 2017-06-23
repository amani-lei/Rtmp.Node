const RTMP_AFM0_TYPE = {
    TYPE_UNKNOW: -1,
    TYPE_NUMBER: 0x00,
    TYPE_BOOLEAN: 0x01,
    TYPE_STRING: 0x02,
    TYPE_OBJECT: 0x03,
    TYPE_NULL: 0x05,
    TYPE_ARRAY_NULL: 0x06,
    TYPE_ECMA_ARRAY: 0x08,
    TYPE_END: 0x09,
    TYPE_ARRAY: 0x0A,
}

const RTMP_INVOKE_TYPE = {
    CONNECT:'connect',
    FCPUBLISH:'FCPublish',
    FCUNPUBLISH:'FCUnpublish',
    CREATE_STREAM:'createStream',
    DELEATE_STREAM:'deleteStream',
    PUBLISH:'publish',
    PLAY:'play',
}
const RTMP_USERCONTROL_EVENTTYPE = {
    STREAM_BEGIN:0,
    SET_BUFFER_LENGTH:3,
}

function amfDecInvoke(buffer){
    var invoke = {};
    invoke.length = 0;
    //cmd name
    var type = buffer.readUInt8(invoke.length);
    invoke.length += 1;
    if(type != RTMP_AFM0_TYPE.TYPE_STRING){
        console.log('[amf] when read cmd name, type:' + type);
        return null;
    }
    var r = amfDecString(buffer.slice(invoke.length));
    invoke.length += r.length;
    invoke.cmdName = r.val;

    //id
    type = buffer.readUInt8(invoke.length);
    invoke.length+=1;
    if(type != RTMP_AFM0_TYPE.TYPE_NUMBER){
        console.log('[amf] when read trans id, type:' + type);
        return null;
    }
    r = amfDecDouble(buffer.slice(invoke.length));
    invoke.length += r.length;
    invoke.transId = r.val;

    if(invoke.cmdName == RTMP_INVOKE_TYPE.CONNECT) {
        type = buffer.readUInt8(invoke.length);
        invoke.length += 1;
        if(type != RTMP_AFM0_TYPE.TYPE_OBJECT){
            console.log('[amf] when read object begin, type:' + type);
            return null;
        }
        r = amfDecObjects(buffer.slice(invoke.length));
        invoke.length += r.length;
        invoke.cmdObject = r.val;
        if(invoke.length < buffer.length){
            type = buffer.readUInt8(invoke.length);
            if(type != RTMP_AFM0_TYPE.TYPE_OBJECT){
                //error
            }
            invoke.length+=1;
            r = amfDecObjects(buffer.slice(invoke.length));
            invoke.length += r.length;
            invoke.userOpt = r.val;
        }
    } else if (invoke.cmdName == RTMP_INVOKE_TYPE.FCPUBLISH) {
        type = buffer.readUInt8(invoke.length);
        invoke.length += 1;
        if(type != RTMP_AFM0_TYPE.TYPE_NULL) {
            //error
        }
        invoke.cmdObject = null;
        type = buffer.readUInt8(invoke.length);
        invoke.length += 1;
        if(type != RTMP_AFM0_TYPE.TYPE_STRING) {
            //error
        }
        r = amfDecString(buffer.slice(invoke.length));
        invoke.length += r.length;
        invoke.streamName = r.val;
    }else if(invoke.cmdName == RTMP_INVOKE_TYPE.RELEASE_STREAM) {
        //seek null
        invoke.length += 1;
        invoke.cmdObject = null;
        //seek type
        invoke.length += 1;
        r = amfDecString(buffer.slice(invoke.length));
        invoke.length += r.length;
        invoke.streamName = r.val;
    }else if(invoke.cmdName == RTMP_INVOKE_TYPE.CREATE_STREAM) {
        //nothing to do

    }else if(invoke.cmdName == RTMP_INVOKE_TYPE.PLAY) {
        //seek null
        invoke.length += 1;
        invoke.cmdObject = null;

        //seek type
        invoke.length += 1;

        r = amfDecString(buffer.slice(invoke.length));
        invoke.length += r.length;
        invoke.streamName = r.val;
        if(invoke.length < buffer.length){

        }
    } else if(invoke.cmdName == RTMP_INVOKE_TYPE.DELEATE_STREAM) {
        //seek null
        invoke.length += 1;
        invoke.cmdObject = null;
        //seek type
        invoke.length += 1;
        r = amfDecDouble(buffer.slice(invoke.length));
        invoke.length += r.length;
        invoke.streamId = r.val;
    }else if(invoke.cmdName == RTMP_INVOKE_TYPE.PUBLISH) {
        //seek null
        invoke.length += 1;
        invoke.cmdObject = null;
        //seek type
        invoke.length += 1;
        r = amfDecString(buffer.slice(invoke.length));
        invoke.length += r.length;
        invoke.streamName = r.val;
        if(invoke.length < buffer.length){
            //seek type
            invoke.length += 1;
            r = amfDecString(buffer.slice(invoke.length));
            invoke.length += r.length;
            invoke.streamType = r.val;
        }
    }
    return invoke;
}
function amfDecMetaData(buffer) {
    var meta = {};
    var type = buffer.readUInt8(0);
    meta.length = 1;
    if(type != RTMP_AFM0_TYPE.TYPE_STRING){
        return null;
    }
    var r = amfDecString(buffer.slice(meta.length));
    meta.length += r.length;
    meta.metaType = r.val;
    type = buffer.readUInt8(meta.length);
    meta.length += 1;
    if(type != RTMP_AFM0_TYPE.TYPE_STRING){
        return null;
    }
    r = amfDecString(buffer.slice(meta.length));
    meta.length += r.length;
    meta.cmdName = r.val;
    type = buffer.readUInt8(meta.length);
    meta.length += 1;
    if(type != RTMP_AFM0_TYPE.TYPE_ECMA_ARRAY){
        return null;
    }
    var r = amfDecArray(buffer.slice(meta.length));
    meta.length += r.length;
    meta.metaData = r.val;
    return meta;
}
function amfEncConnectResult(invoke, succeed = true) {
    var ret = [];
    ret.push(amfEncString(succeed ? '_result' : 'error'));
    if(! succeed ) {
        return ret;
    }
    ret.push(amfEncNumber(invoke.transId));
    ret.push(amfEncObjectBegin());
    ret.push(amfEncStringObject('fmsVer', 'FMS/3,0,1,123'));
    ret.push(amfEncNumberObject('capabilities', 31));
    ret.push(amfEncEnd());
    ret.push(amfEncObjectBegin());
    ret.push(amfEncStringObject('level', 'status'));
    ret.push(amfEncStringObject('code', 'NetConnection.Connect.Success'));
    ret.push(amfEncStringObject('description', 'Connection succeeded.'));
    ret.push(amfEncNumberObject('objectEncoding', 0));
    //ret.push(amfEncStringObject('fmsVer', 'FMS/3,0,1,123'));
    ret.push(amfEncEnd());
    return Buffer.concat(ret);
}

function amfEncCreateStreamResult(invoke, streamid, succeed = true) {
    var ret = [];
    ret.push(amfEncString(succeed ? '_result' : 'error'));
    if(! succeed ) {
        return ret;
    }
    ret.push(amfEncNumber(invoke.transId));
    ret.push(amfEncNull());
    ret.push(amfEncNumber(streamid));
    return Buffer.concat(ret);
}

function amfEncPublishResult(succeed = true) {
    var ret = [];
    ret.push(amfEncString('onStatus'));
    ret.push(amfEncNumber(0));
    ret.push(amfEncNull());
    ret.push(amfEncObjectBegin());
    ret.push(amfEncStringObject('level', 'status'));
    ret.push(amfEncStringObject('code', 'NetStream.Publish.Start'));
    ret.push(amfEncStringObject('description', 'Rtmp.Node:Start publishing'));
    ret.push(amfEncEnd());
    return Buffer.concat(ret);
}

function amfEncDeleteStreamResult() {
    var ret = [];
    ret.push(amfEncString('onStatus'));
    ret.push(amfEncNumber(0));
    ret.push(amfEncNull());
    ret.push(amfEncObjectBegin());
    ret.push(amfEncStringObject('level', 'status'));
    ret.push(amfEncStringObject('code', 'NetStream.Unpublish.Success'));
    ret.push(amfEncStringObject('description', 'Rtmp.Node:Stop publishing'));
    ret.push(amfEncEnd());
    return Buffer.concat(ret);
}
function amfEncPlayResult (success = true) {
    var ret = [];
    ret.push(amfEncString('onStatus'));
    ret.push(amfEncNumber(0));
    ret.push(amfEncNull());
    ret.push(amfEncObjectBegin());
    ret.push(amfEncStringObject('level', 'status'));
    if(success){
        ret.push(amfEncStringObject('code', 'NetStream.Play.Start'));
        ret.push(amfEncStringObject('description', 'Rtmp.Node:Start live'));
    }else{
        ret.push(amfEncStringObject('code', 'NetStream.Play.StreamNotFound'));
        ret.push(amfEncStringObject('description', 'Rtmp.Node:stream not found'));
    }
    ret.push(amfEncEnd());
    return Buffer.concat(ret);
}

function amfDecBoolean(buffer) {
    var ret = {};
    ret.val = buffer.readUInt8(0) != 0;
    ret.length = 1;
    return ret;
}

function amfDecDouble(buffer) {
    var ret = {};
    ret.val = buffer.readDoubleBE(0,8);
    ret.length = 8;
    return ret;
}
function amfDecNumber(buffer) {
    var ret = {};
    ret.val = buffer.readUIntBE(0,4);
    ret.length = 4;
    return ret;
}

function amfDecString(buffer) {
    var ret = {};
    var len = buffer.readUIntBE(0,2);
    ret.length = 2;
    var strBuf = buffer.slice(2, 2+ len);
    ret.length += len;
    ret.val = strBuf.toString('ascii');
    return ret;
}
function amfDecObjects(buffer) {
    var ret = {};
    ret.length = 0;
    ret.val = {};
    do{
        var val = {};
        var r = amfDecObject(buffer.slice(ret.length));
        ret.length += r.length;
        ret.val[r.name] = r.val;
    }while(!(buffer[ret.length] ==0 && buffer[ret.length + 1] == 0 && buffer[ret.length + 2] == 9));
    ret.length+=3;
    return ret;
}
function amfDecObject(buffer){
    var ret = {};
    var len = buffer.readUIntBE(0,2);
    ret.length = 2;
    ret.name = buffer.slice(2, 2 + len).toString('ascii');
    ret.length += len;
    ret.type = buffer.readUInt8(ret.length);
    ret.length += 1;
    var r = null;
    switch(ret.type){
        case RTMP_AFM0_TYPE.TYPE_NUMBER:
            r = amfDecDouble(buffer.slice(ret.length));
            break;
        case RTMP_AFM0_TYPE.TYPE_BOOLEAN:
            r = amfDecBoolean(buffer.slice(ret.length));
            break;
        case RTMP_AFM0_TYPE.TYPE_STRING:
            r = amfDecString(buffer.slice(ret.length));
            break;
        default:
            console.log('[amf] unknow object:' + ret.type);
            break;
    }
    ret.val = r.val;
    ret.length += r.length;
    return ret;
}
function amfDecArray(buffer) {
    var ret = {};
    var size = buffer.readUIntBE(0, 4);
    ret.length = 4;
    ret.size = size;
    ret.val = {};
    for(var i = 0; i < size; ++i) {
        var val = {};
        var r = amfDecObject(buffer.slice(ret.length));
        ret.length += r.length;
        ret.val[r.name] = r.val;
    }
    ret.length+=3;
    return ret;
}
function amfEncNumber(val) {
    var ret = new Buffer(9);
    ret[0] = RTMP_AFM0_TYPE.TYPE_NUMBER;
    ret.writeDoubleBE(val,1, 8);
    return ret;
}

function amfEncBoolean(val) {
    var ret = new Buffer(2);
    ret[0] = RTMP_AFM0_TYPE.TYPE_BOOLEAN;
    ret[1] = val ? 1 : 0;
    return ret;
}

function amfEncString(val) {
    var ret = new Buffer(3 + val.length);
    ret.writeUInt8(RTMP_AFM0_TYPE.TYPE_STRING,0);
    ret.writeUInt16BE(val.length, 1);
    ret.write(val,3);
    return ret;
}

function amfEncObjectBegin() {
    var ret = new Buffer(1);
    ret[0] = 0x03;
    return ret;
}

function amfEncEnd() {
    var ret = new Buffer(3);
    ret[0] = 0x00;
    ret[1] = 0x00;
    ret[2] = 0x09;
    return ret;
}

function amfEncNull() {
    var ret = new Buffer(1);
    ret[0] = 0x05;
    return ret;
}

function amfEncNumberObject(name, val) {
    var ret = [];
    var nameBuffer = new Buffer(2+name.length);
    nameBuffer.writeUInt16BE(name.length,0);
    nameBuffer.write(name,2);
    ret.push(nameBuffer);
    ret.push(amfEncNumber(val));
    return Buffer.concat(ret);
}

function amfEncBooleanObject(name, val) {
    var ret = [];
    var nameBuffer = new Buffer(2+name.length);
    nameBuffer.writeUInt16BE(name.length,0);
    nameBuffer.write(name,2);
    ret.push(nameBuffer);
    ret.push(amfEncBoolean(val));
    return Buffer.concat(ret);
}

function amfEncStringObject(name, val) {
    var ret = [];
    var nameBuffer = new Buffer(2+name.length);
    nameBuffer.writeUInt16BE(name.length,0);
    nameBuffer.write(name,2);
    ret.push(nameBuffer);
    ret.push(amfEncString(val));
    return Buffer.concat(ret);
}

function amfEncSampleAccess(){
    var ret = [];
    ret.push(amfEncString('|RtmpSampleAccess'));
    ret.push(amfEncBoolean(true));
    ret.push(amfEncBoolean(true));
    return Buffer.concat(ret);
}
module.exports = AMF ={
    RTMP_AFM0_TYPE:RTMP_AFM0_TYPE,
    RTMP_INVOKE_TYPE:RTMP_INVOKE_TYPE,
    amfDecInvoke:amfDecInvoke,
    amfDecMetaData:amfDecMetaData,
    amfDecBoolean:amfDecBoolean,
    amfDecDouble:amfDecDouble,
    amfDecObject:amfDecObject,
    amfDecString:amfDecString,
    amfEncBoolean:amfEncBoolean,
    amfEncBooleanObject:amfEncBooleanObject,
    amfEncNumber:amfEncNumber,
    amfEncNumberObject:amfEncNumberObject,
    amfEncObjectBegin:amfEncObjectBegin,
    amfEncEnd:amfEncEnd,
    amfEncString:amfEncString,
    amfEncStringObject:amfEncStringObject,
    amfEncConnectResult:amfEncConnectResult,
    amfEncCreateStreamResult:amfEncCreateStreamResult,
    amfEncPublishResult:amfEncPublishResult,
    amfEncDeleteStreamResult:amfEncDeleteStreamResult,
    amfEncPlayResult:amfEncPlayResult,
    amfEncSampleAccess:amfEncSampleAccess,
};