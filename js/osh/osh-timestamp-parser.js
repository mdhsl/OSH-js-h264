OSH.TimeStampParser = {
	version: 'dev'
};

window.OSH.TimeStampParser = OSH.TimeStampParser;

var UTCAndroidShiftTime = 16 * 1000;

/**
 * Utility class to extract timeStamp from various data.
 */ 
OSH.TimeStampParser = function() {}


/**
 *  Parses the text to extract timeStamp. This method is specific for android timeStamp because of the UTC shift time used by android.
 */  
OSH.TimeStampParser.parseAndroidText = function(data) {
  var rec = String.fromCharCode.apply(null, new Uint8Array(data));
  var tokens = rec.trim().split(",");
  var date = new Date(tokens[0]);
  return date.getTime() - UTCAndroidShiftTime;
};

/**
 * Parses the binary data to extract timeStamp. This method will extract the first 64 bits from the binary value given as parameter.
 */ 
OSH.TimeStampParser.parseMpegVideo = function(data) {
   return new DataView(data).getFloat64(0, false) * 1000; // read double time stamp as big endian
};

/**
 * Parses the binary data to extract timeStamp. This method will extract the first 64 bits from the binary value given as parameter.
 */ 
OSH.TimeStampParser.parseMp4Video = function(data) {
   
   /*if(!this.videoMp4Parser) {
    this.videoMp4Parser = new OSH.TimeStampParser.VideoMP4();
   }*/
   //this.videoMp4Parser.parse(data);
      var data = new Uint8Array(data);
      var dataView = new DataView(event.data).getFloat64(48 * 8, false);
      console.log(readNCC(dataView));
      console.log(new Uint8Array(data));
      return new Date().getTime();
      
};

OSH.TimeStampParser.VideoMP4 = function() {
    this.absoluteTime = -1;
};

OSH.TimeStampParser.VideoMP4.prototype.parse = function(data) {
    // got the first box => MVDH
    if(this.absoluteTime == -1) {
        var infos = readMP4Info(data);
        
        console.log("PTS : "+infos.pts);
        console.log("timeScale : "+infos.timeScale);
        console.log("duration : "+infos.duration);
        console.log("rate : "+infos.rate);
        
        this.absoluteTime = infos.absoluteTime;
        this.timeScale = infos.timeScale;
        
        return this.absoluteTime;
    } else {
        // for debug only --> MVDH has already been calculated 
        // got the first box
        var infos = readMP4Info(data);
        console.log("PTS : "+infos.pts);
        console.log("timeScale : "+infos.timeScale);
        console.log("duration : "+infos.duration);
        console.log("rate : "+infos.rate);
        // end debug
        console.log("FrameRate: "+this.pts+" --> "+infos.pts);
        return ((infos.pts*1000)*this.timeScale)+this.absoluteTime;
    }
};

function readMP4Info(data) {
    var infos = {
      absoluteTime:0,
      pts:0,
      timeScale:0,
      duration:0,
      rate:0
    };
  
   var pos = 60; // 60 bytes
    // starts at 60 bytes length
    infos.absoluteTime = new DataView(data,pos,pos+8).getUint32(0); //8 bytes length but takes the  last four
    infos.absoluteTime = (infos.absoluteTime - 2082844800)*1000;
    console.log(new Date(infos.absoluteTime).toISOString());
    pos += 8;
    
    //modification time// 32 bits
    infos.pts = new DataView(data,pos,pos+4).getUint32(0); //4 bytes length
    pos += 4;
    
    //time scale // 32 bits
    infos.timeScale = new DataView(data,pos,pos+4).getUint32(0); //4 bytes length
    infos.timeScale = 1/(infos.timeScale);
    pos += 4;
    
    //duration // 32 bits
    infos.duration = new DataView(data,pos,pos+4).getUint32(0); //4 bytes length
    pos += 4;
    
    //rate  // 32 bits / 65536
    infos.rate = (new DataView(data,pos,pos+4).getUint32(0));
    
    return infos;
}
