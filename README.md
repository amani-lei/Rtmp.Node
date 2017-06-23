# Rtmp.Node

## WHAT
Based on the node. Js RTMP server



## HOW
node app.js

## TEST
### publish stream
ffmpeg -re -i $YOUER_MEDIA_FILE -f flv rtmp://$IP:$PORT/$AppName/$StreamName
### play stream
ffplay -i rtmp://$IP:$PORT/$AppName/$StreamName

## THINKS
### Node-Media-Server
https://github.com/illuspas/Node-Media-Server

## REF
FFMpeg
https://www.ffmpeg.org

Rtmp
http://aiflying.com/doc/rtmp_specification_1.0.pdf
