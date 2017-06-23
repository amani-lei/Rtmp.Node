function WSAdapter(ws){
    var self = this;
    this.ws = ws;
    this.onData = null;
    this.onEnd = null;
    this.onError = null;
    WSAdapter.prototype.on = function(signal, handler) {
        if(signal == 'data'){
            self.onData = handler;
        }else if(signal == 'end'){
            self.onEnd = handler;
        }else if(signal == 'error'){
            self.onError = handler;
        }
    }
    WSAdapter.prototype.init = function (){
        self.ws.on('message',function(message){
            
        });
        self.ws.on('close', function(ws){
            
        });
    }
}