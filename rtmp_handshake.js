var Crypto = require('crypto');
var MESSAGE_FORMAT_0 = 0;
var MESSAGE_FORMAT_1 = 1;
var MESSAGE_FORMAT_2 = 2;

var RTMP_SIG_SIZE = 1536;
var SHA256DL = 32;

var RandomCrud = new Buffer([
    0xf0, 0xee, 0xc2, 0x4a, 0x80, 0x68, 0xbe, 0xe8,
    0x2e, 0x00, 0xd0, 0xd1, 0x02, 0x9e, 0x7e, 0x57,
    0x6e, 0xec, 0x5d, 0x2d, 0x29, 0x80, 0x6f, 0xab,
    0x93, 0xb8, 0xe6, 0x36, 0xcf, 0xeb, 0x31, 0xae
]);

var GenuineFMSConst = "Genuine Adobe Flash Media Server 001";
var GenuineFMSConstCrud = Buffer.concat([new Buffer(GenuineFMSConst, "utf8"), RandomCrud]);

var GenuineFPConst = "Genuine Adobe Flash Player 001";
var GenuineFPConstCrud = Buffer.concat([new Buffer(GenuineFPConst, "utf8"), RandomCrud]);

class RtmpHandshake {
    static GenerateHandshakeS0S1S2 (c0c1) {
        var protVersion = c0c1.slice(0,1);
        var clientSig = c0c1.slice(1, 1537);
        var s0s1s2 = null;
        if(protVersion == 0){
            //simple handshake
            s0s1s2 = Buffer.concat([protVersion, clientSig, clientSig]);
        }else{
            //complex handshake
            s0s1s2 = Buffer.concat([protVersion, RtmpHandshake.generateS1(protVersion), RtmpHandshake.generateS2(protVersion, clientSig)]);
        }
        return s0s1s2;
    }
    static generateS1(protVersion) {
        var randomBytes = Crypto.randomBytes(1536 - 8);
        var handshakeBytes = Buffer.concat([new Buffer([0, 0, 0, 0, 1, 2, 3, 4]), randomBytes], 1536);

        var serverDigestOffset;
        if (protVersion === 1) {
            serverDigestOffset = RtmpHandshake.GetClientGenuineConstDigestOffset(handshakeBytes.slice(8, 12));
        } else {
            serverDigestOffset = RtmpHandshake.GetServerGenuineConstDigestOffset(handshakeBytes.slice(772, 776));
        }

        var msg = Buffer.concat([handshakeBytes.slice(0, serverDigestOffset), handshakeBytes.slice(serverDigestOffset + 32)], 1536 - 32);
        var hash = RtmpHandshake.calcHmac(msg, GenuineFMSConst);
        hash.copy(handshakeBytes, serverDigestOffset, 0, 32);
        return handshakeBytes;
    }

    static generateS2(protVersion, clientsig) {
        var randomBytes = Crypto.randomBytes(1536 - 32);
        var challengeKeyOffset;
        if (protVersion === 1) {
            challengeKeyOffset = RtmpHandshake.GetClientGenuineConstDigestOffset(clientsig.slice(8, 12));
        } else {
            challengeKeyOffset = RtmpHandshake.GetServerGenuineConstDigestOffset(clientsig.slice(772, 776));
        }
        var challengeKey = clientsig.slice(challengeKeyOffset, challengeKeyOffset + 32);
        var hash = RtmpHandshake.calcHmac(challengeKey, GenuineFMSConstCrud);
        var signature = RtmpHandshake.calcHmac(randomBytes, hash);

        var s2Bytes = Buffer.concat([randomBytes, signature], 1536);
        return s2Bytes;
    }
    static calcHmac(data, key) {
        var hmac = Crypto.createHmac('sha256', key);
        hmac.update(data);
        return hmac.digest();
    }

    static GetClientGenuineConstDigestOffset(buf) {
        var offset = buf[0] + buf[1] + buf[2] + buf[3];
        offset = (offset % 728) + 12;
        return offset;
    }

    static GetServerGenuineConstDigestOffset(buf) {
        var offset = buf[0] + buf[1] + buf[2] + buf[3];
        offset = (offset % 728) + 776;
        return offset;
    }

    static detectClientMessageFormat(clientsig) {
        var computedSignature, msg, providedSignature, sdl;
        sdl = RtmpHandshake.GetServerGenuineConstDigestOffset(clientsig.slice(772, 776));
        msg = Buffer.concat([clientsig.slice(0, sdl), clientsig.slice(sdl + SHA256DL)], 1504);
        computedSignature = RtmpHandshake.calcHmac(msg, GenuineFPConst);
        providedSignature = clientsig.slice(sdl, sdl + SHA256DL);
        if (computedSignature.equals(providedSignature)) {
            return MESSAGE_FORMAT_2;
        }
        sdl = RtmpHandshake.GetClientGenuineConstDigestOffset(clientsig.slice(8, 12));
        msg = Buffer.concat([clientsig.slice(0, sdl), clientsig.slice(sdl + SHA256DL)], 1504);
        computedSignature = RtmpHandshake.calcHmac(msg, GenuineFPConst);
        providedSignature = clientsig.slice(sdl, sdl + SHA256DL);
        if (computedSignature.equals(providedSignature)) {
            return MESSAGE_FORMAT_1;
        }
        return MESSAGE_FORMAT_0;
    }
}
module.exports = RtmpHandshake;