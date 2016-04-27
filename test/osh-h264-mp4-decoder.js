var OshMp4Decoder = function(options){
  this._config = options || {};
  this.hasSps = false;
  this.hasPps = false;
  if (!this._config.div){
    error("Cannot find div parameter");
    return;
  } 
  this.div = this._config.div;
  
  this.mp4box = new MP4Box();
  
  var mime = 'video/mp4;codecs="avc1.4d001e,mp4a.40.2"';
  
	var video = document.createElement("video");
	this.div.innerHTML='';
	this.div.appendChild(video);
	this.mediaSource = new MediaSource();
  
  this.mp4box.onReady = function(info) { 
		/*track_id = info.tracks[0].id;
		mp4box.setSegmentOptions(track_id, null, { nbSamples: 10, rapAlignement: true } );
		var initSegs = mp4box.initializeSegmentation();
		var mime = 'video/mp4; codecs=\"'+info.tracks[0].codec+'\"';
		var sb = ms.addSourceBuffer(mime);
		sb.addEventListener("updateend", onInitAppended);
		sb.appendBuffer(initSegs[0].buffer);*/
    console.log("ici");
	}
  
  var self = this;
  function onSourceOpen(e) {
    console.log("MediaSource Opened!");
    self.mp4box.setSegmentOptions(0, null, { nbSamples: 10, rapAlignement: true } );
		var initSegs = self.mp4box.initializeSegmentation();
    var sb = self.mediaSource.addSourceBuffer(mime);
    
    //add moov at the first append
    sb.appendBuffer(initSegs[0].buffer);
	};
  
  function onSourceClose(e) {
		console.log("MediaSource closed!");
	}
  
  this.mediaSource.addEventListener("sourceopen", onSourceOpen);
	this.mediaSource.addEventListener("sourceclose", onSourceClose);
	video.src = window.URL.createObjectURL(this.mediaSource);
  
};

OshMp4Decoder.prototype.read = function(nal) {
   this.mp4box.appendBuffer(nal);
};

/**
 * Read binary data, split them into NAL unit and detect SPS + PPS
 */
OshMp4Decoder.prototype.readAll = function(data) {
  //var track = mp4box.addTrack(mime, options)
  this.computeFullNalFromRaw(data,new function(nal) {
      var nalType = nal[0] & 0x1F;
      //7 => PPS
      //8 => SPS
      //6 => SEI
      //5 => IDR
      if (nalType != 7 && nalType != 8 && nalType != 1 && nalType != 5 & nalType != 6)
        return;
      if (nalType == 7)
        this.hasSps = true;
      if (nalType == 8)
        this.hasPps = true;
     if (this.hasSps && this.hasPps){
        this.read(nal);
     }
  }.bind(this));
};

OshMp4Decoder.prototype.computeFullNalFromRaw = function(data,callback) {
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

OshMp4Decoder.prototype.onUpdateStats = function(fps) {};
