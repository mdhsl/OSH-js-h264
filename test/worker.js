importScripts('Decoder.js', 'YUVCanvas.js', 'Player.js','stream.js');

//creates the player/decoder
/*var avcWs = new Player({
  useWorker: true,
  reuseMemory: false,
  webgl: "auto",
  size: {
    width: 200,
    height: 200
  }
});

//gets canvas from the player. the player creates automaticaly a canvas
var canvas = avcWs.canvas
var domNode = document.getElementById("broadway-ws");
domNode.appendChild(canvas);
var fps = 0;
var nbFps = -1;
var startDate = null;            
var bufferDecode = new Array();
var renderOk = true;
//after decoding, the frame is rendered into the canvas
avcWs.onPictureDecoded = function(yuvBuffer, width, height) {
    if(nbFps == -1){
      startDate = new Date().getTime();
      nbFps = 1;
    } else {
      nbFps++;
    }
    fps = (nbFps / (new Date().getTime() - startDate)) * 1000; // *1000 because getTime() returs time in ms, *1000 to get the value for 1 second
    renderOk = true;
};*/

var decoder = new Decoder();

//FPS
var fps = 0;
var nbFps = -1;
var startDate = null;  

decoder.onPictureDecoded = function(yuvBuffer, width, height) {
  if(nbFps == -1){
      startDate = new Date().getTime();
      nbFps = 1;
  } else {
      nbFps++;
  }
  fps = (nbFps / (new Date().getTime() - startDate)) * 1000; // *1000 because getTime() returs time in ms, *1000 to get the value for 1 second
  postMessage([fps,yuvBuffer,width,height]);
}

onmessage = function(e) {
  decoder.decode(e.data[0]);
}
