var OshRawDecoder = function(options){
  this._config = options || {};
  
  this.hasSps = false;
  if (!this._config.div){
    error("Cannot find div parameter");
    return;
  } 
  this.div = this._config.div;
  
  var useWorker = true;
  var reuseMemory = true;
  var webgl = "auto";
  
  if (this._config.useWorker){
    useWorker = this._config.useWorker;
  }
  
  if(this._config.reuseMemory) {
    reuseMemory = this._config.reuseMemory;
  }
  
  if(this._config.webgl) {
    webgl = this._config.webgl;
  }
  
  this.avcWs = new Player({
    useWorker: useWorker,
    reuseMemory: reuseMemory,
    webgl: webgl,
    size: {
      width: 200,
      height: 200
    }
  });
            
  var canvas = this.avcWs.canvas
  var domNode = this.div;
  domNode.appendChild(canvas);
  
  //FPS
  var fps = 0;
  var nbFps = -1;
  var startDate = null;  
            
  this.avcWs.onPictureDecoded = function(yuvBuffer, width, height) {
      if(nbFps == -1){
          startDate = new Date().getTime();
          nbFps = 1;
      } else {
          nbFps++;
      }
      fps = (nbFps / (new Date().getTime() - startDate)) * 1000; // *1000 because getTime() returs time in ms, *1000 to get the value for 1 second
      this.onUpdateStats(fps);
  }.bind(this);
};

OshRawDecoder.prototype.read = function(nal) {
    this.avcWs.decode(nal);
};

/**
 * Read binary data, split them into NAL unit and detect SPS + PPS
 */
OshRawDecoder.prototype.readAll = function(data) {
   this.computeFullNalFromRaw(data,function(nal) {
      var nalType = nal[0] & 0x1F;
      //7 => PPS
      //8 => SPS
      //6 => SEI
      //5 => IDR
      if (nalType != 7 && nalType != 8 && nalType != 1 && nalType != 5 & nalType != 6)
        return;
      if (nalType == 7)
        this.hasSps = true;
     if (this.hasSps){
        this.read(nal);
     }
   }.bind(this));
};

OshRawDecoder.prototype.computeFullNalFromRaw = function(data,callback) {
    if(!(data && data.length)) {
      return;
    } else {
      var endIndex   = -1;
      var firstIndex = -1;

      // find first NAL separator
      var nalSeparator = false;
      while((firstIndex = data.indexOf(1,firstIndex+1)) != -1){
          nalSeparator = data[firstIndex-1] == 0;
          nalSeparator &= data[firstIndex-2] == 0;
          nalSeparator &= data[firstIndex-3] == 0;
          if (nalSeparator)
             break;
      }
          
      //if found a NAL separator
      if(nalSeparator) {
          endIndex = firstIndex;
          //gets the data until the next separator
          while((endIndex = data.indexOf(1,endIndex+1)) != -1){
            nalSeparator = data[endIndex-1] == 0;
            nalSeparator &= data[endIndex-2] == 0;
            nalSeparator &= data[endIndex-3] == 0;
        
            //end separator found, callback full NAL unit
            if(nalSeparator) {
                callback(data.subarray(firstIndex+1,endIndex-3)); // subarray provides a new view of the array
                firstIndex = endIndex;
          }
      }
      
      if(endIndex == -1) {
        //otherwise = end of buffer       
        callback(data.subarray(firstIndex+1,data.length));  // subarray provides a new view of the array
        firstIndex = endIndex;        
      }
    }
  }
};

OshRawDecoder.prototype.onUpdateStats = function(fps) {};
