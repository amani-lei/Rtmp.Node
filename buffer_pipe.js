var Readable = require('stream').Readable;

class BufferPipe extends Readable {
    constructor(options) {
        super(options);
        this.needSize = 0;
        this.length = 0;
    }
    init(gfun) {
        this.gfun = gfun;            
        this.gfun.next();
    }
    push(data) {
        super.push(data);
        this.length += data.length;
        if(this.needSize > 0 && this.length >= this.needSize){
            this.gfun.next();
        }
    }
    _read(size){
    }
    read(size) {
        this.length -= size;
        this.needSize -= size;
        if(this.needSize < 0)
            this.needSize = 0;
        return super.read(size);
    }
    need(size) {
    var ret = this.length < size;
    if(ret) {
        this.needSize = size;
    }
    return ret;
    }

}
module.exports = BufferPipe;