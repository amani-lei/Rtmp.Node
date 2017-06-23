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
