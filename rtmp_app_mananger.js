
var RtmpApp = require('./rtmp_app.js');
class RtmpAppManager {
    constructor(){
        this.apps = new Map();
    }
    //协议对象, app名
    onConnect(protocolObject, appName){
        var app = this.apps.get(appName);
        if(!app){
            app = new RtmpApp(appName);
            this.apps.set(appName, app);
        }
        protocolObject.listener.onProtocolCreateStream = this.onProtocolCreateStream.bind(this, protocolObject);
        app.onConnect(protocolObject);
        return true;
    }
    getApp(appName){
        var app = this.apps.get(appName);
        if(!app){
            app = new RtmpApp(appName);
            this.apps.set(appName, app);
        }
        return app;
    }

}

module.exports = RtmpAppManager;