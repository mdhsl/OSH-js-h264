/**
 * @license jahashtable, a JavaScript implementation of a hash table. It creates a single constructor function called
 * Hashtable in the global scope.
 *
 * http://www.timdown.co.uk/jshashtable/
 * Copyright %%build:year%% Tim Down.
 * Version: %%build:version%%
 * Build date: %%build:date%%
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var Hashtable = (function(UNDEFINED) {
    var FUNCTION = "function", STRING = "string", UNDEF = "undefined";

    // Require Array.prototype.splice, Object.prototype.hasOwnProperty and encodeURIComponent. In environments not
    // having these (e.g. IE <= 5), we bail out now and leave Hashtable null.
    if (typeof encodeURIComponent == UNDEF ||
            Array.prototype.splice === UNDEFINED ||
            Object.prototype.hasOwnProperty === UNDEFINED) {
        return null;
    }

    function toStr(obj) {
        return (typeof obj == STRING) ? obj : "" + obj;
    }

    function hashObject(obj) {
        var hashCode;
        if (typeof obj == STRING) {
            return obj;
        } else if (typeof obj.hashCode == FUNCTION) {
            // Check the hashCode method really has returned a string
            hashCode = obj.hashCode();
            return (typeof hashCode == STRING) ? hashCode : hashObject(hashCode);
        } else {
            return toStr(obj);
        }
    }
    
    function merge(o1, o2) {
        for (var i in o2) {
            if (o2.hasOwnProperty(i)) {
                o1[i] = o2[i];
            }
        }
    }

    function equals_fixedValueHasEquals(fixedValue, variableValue) {
        return fixedValue.equals(variableValue);
    }

    function equals_fixedValueNoEquals(fixedValue, variableValue) {
        return (typeof variableValue.equals == FUNCTION) ?
            variableValue.equals(fixedValue) : (fixedValue === variableValue);
    }

    function createKeyValCheck(kvStr) {
        return function(kv) {
            if (kv === null) {
                throw new Error("null is not a valid " + kvStr);
            } else if (kv === UNDEFINED) {
                throw new Error(kvStr + " must not be undefined");
            }
        };
    }

    var checkKey = createKeyValCheck("key"), checkValue = createKeyValCheck("value");

    /*----------------------------------------------------------------------------------------------------------------*/

    function Bucket(hash, firstKey, firstValue, equalityFunction) {
        this[0] = hash;
        this.entries = [];
        this.addEntry(firstKey, firstValue);

        if (equalityFunction !== null) {
            this.getEqualityFunction = function() {
                return equalityFunction;
            };
        }
    }

    var EXISTENCE = 0, ENTRY = 1, ENTRY_INDEX_AND_VALUE = 2;

    function createBucketSearcher(mode) {
        return function(key) {
            var i = this.entries.length, entry, equals = this.getEqualityFunction(key);
            while (i--) {
                entry = this.entries[i];
                if ( equals(key, entry[0]) ) {
                    switch (mode) {
                        case EXISTENCE:
                            return true;
                        case ENTRY:
                            return entry;
                        case ENTRY_INDEX_AND_VALUE:
                            return [ i, entry[1] ];
                    }
                }
            }
            return false;
        };
    }

    function createBucketLister(entryProperty) {
        return function(aggregatedArr) {
            var startIndex = aggregatedArr.length;
            for (var i = 0, entries = this.entries, len = entries.length; i < len; ++i) {
                aggregatedArr[startIndex + i] = entries[i][entryProperty];
            }
        };
    }

    Bucket.prototype = {
        getEqualityFunction: function(searchValue) {
            return (typeof searchValue.equals == FUNCTION) ? equals_fixedValueHasEquals : equals_fixedValueNoEquals;
        },

        getEntryForKey: createBucketSearcher(ENTRY),

        getEntryAndIndexForKey: createBucketSearcher(ENTRY_INDEX_AND_VALUE),

        removeEntryForKey: function(key) {
            var result = this.getEntryAndIndexForKey(key);
            if (result) {
                this.entries.splice(result[0], 1);
                return result[1];
            }
            return null;
        },

        addEntry: function(key, value) {
            this.entries.push( [key, value] );
        },

        keys: createBucketLister(0),

        values: createBucketLister(1),

        getEntries: function(destEntries) {
            var startIndex = destEntries.length;
            for (var i = 0, entries = this.entries, len = entries.length; i < len; ++i) {
                // Clone the entry stored in the bucket before adding to array
                destEntries[startIndex + i] = entries[i].slice(0);
            }
        },

        containsKey: createBucketSearcher(EXISTENCE),

        containsValue: function(value) {
            var entries = this.entries, i = entries.length;
            while (i--) {
                if ( value === entries[i][1] ) {
                    return true;
                }
            }
            return false;
        }
    };

    /*----------------------------------------------------------------------------------------------------------------*/

    // Supporting functions for searching hashtable buckets

    function searchBuckets(buckets, hash) {
        var i = buckets.length, bucket;
        while (i--) {
            bucket = buckets[i];
            if (hash === bucket[0]) {
                return i;
            }
        }
        return null;
    }

    function getBucketForHash(bucketsByHash, hash) {
        var bucket = bucketsByHash[hash];

        // Check that this is a genuine bucket and not something inherited from the bucketsByHash's prototype
        return ( bucket && (bucket instanceof Bucket) ) ? bucket : null;
    }

    /*----------------------------------------------------------------------------------------------------------------*/

    function Hashtable() {
        var buckets = [];
        var bucketsByHash = {};
        var properties = {
            replaceDuplicateKey: true,
            hashCode: hashObject,
            equals: null
        };

        var arg0 = arguments[0], arg1 = arguments[1];
        if (arg1 !== UNDEFINED) {
            properties.hashCode = arg0;
            properties.equals = arg1;
        } else if (arg0 !== UNDEFINED) {
            merge(properties, arg0);
        }

        var hashCode = properties.hashCode, equals = properties.equals;

        this.properties = properties;

        this.put = function(key, value) {
            checkKey(key);
            checkValue(value);
            var hash = hashCode(key), bucket, bucketEntry, oldValue = null;

            // Check if a bucket exists for the bucket key
            bucket = getBucketForHash(bucketsByHash, hash);
            if (bucket) {
                // Check this bucket to see if it already contains this key
                bucketEntry = bucket.getEntryForKey(key);
                if (bucketEntry) {
                    // This bucket entry is the current mapping of key to value, so replace the old value.
                    // Also, we optionally replace the key so that the latest key is stored.
                    if (properties.replaceDuplicateKey) {
                        bucketEntry[0] = key;
                    }
                    oldValue = bucketEntry[1];
                    bucketEntry[1] = value;
                } else {
                    // The bucket does not contain an entry for this key, so add one
                    bucket.addEntry(key, value);
                }
            } else {
                // No bucket exists for the key, so create one and put our key/value mapping in
                bucket = new Bucket(hash, key, value, equals);
                buckets.push(bucket);
                bucketsByHash[hash] = bucket;
            }
            return oldValue;
        };

        this.get = function(key) {
            checkKey(key);

            var hash = hashCode(key);

            // Check if a bucket exists for the bucket key
            var bucket = getBucketForHash(bucketsByHash, hash);
            if (bucket) {
                // Check this bucket to see if it contains this key
                var bucketEntry = bucket.getEntryForKey(key);
                if (bucketEntry) {
                    // This bucket entry is the current mapping of key to value, so return the value.
                    return bucketEntry[1];
                }
            }
            return null;
        };

        this.containsKey = function(key) {
            checkKey(key);
            var bucketKey = hashCode(key);

            // Check if a bucket exists for the bucket key
            var bucket = getBucketForHash(bucketsByHash, bucketKey);

            return bucket ? bucket.containsKey(key) : false;
        };

        this.containsValue = function(value) {
            checkValue(value);
            var i = buckets.length;
            while (i--) {
                if (buckets[i].containsValue(value)) {
                    return true;
                }
            }
            return false;
        };

        this.clear = function() {
            buckets.length = 0;
            bucketsByHash = {};
        };

        this.isEmpty = function() {
            return !buckets.length;
        };

        var createBucketAggregator = function(bucketFuncName) {
            return function() {
                var aggregated = [], i = buckets.length;
                while (i--) {
                    buckets[i][bucketFuncName](aggregated);
                }
                return aggregated;
            };
        };

        this.keys = createBucketAggregator("keys");
        this.values = createBucketAggregator("values");
        this.entries = createBucketAggregator("getEntries");

        this.remove = function(key) {
            checkKey(key);

            var hash = hashCode(key), bucketIndex, oldValue = null;

            // Check if a bucket exists for the bucket key
            var bucket = getBucketForHash(bucketsByHash, hash);

            if (bucket) {
                // Remove entry from this bucket for this key
                oldValue = bucket.removeEntryForKey(key);
                if (oldValue !== null) {
                    // Entry was removed, so check if bucket is empty
                    if (bucket.entries.length == 0) {
                        // Bucket is empty, so remove it from the bucket collections
                        bucketIndex = searchBuckets(buckets, hash);
                        buckets.splice(bucketIndex, 1);
                        delete bucketsByHash[hash];
                    }
                }
            }
            return oldValue;
        };

        this.size = function() {
            var total = 0, i = buckets.length;
            while (i--) {
                total += buckets[i].entries.length;
            }
            return total;
        };
    }

    Hashtable.prototype = {
        each: function(callback) {
            var entries = this.entries(), i = entries.length, entry;
            while (i--) {
                entry = entries[i];
                callback(entry[0], entry[1]);
            }
        },

        equals: function(hashtable) {
            var keys, key, val, count = this.size();
            if (count == hashtable.size()) {
                keys = this.keys();
                while (count--) {
                    key = keys[count];
                    val = hashtable.get(key);
                    if (val === null || val !== this.get(key)) {
                        return false;
                    }
                }
                return true;
            }
            return false;
        },

        putAll: function(hashtable, conflictCallback) {
            var entries = hashtable.entries();
            var entry, key, value, thisValue, i = entries.length;
            var hasConflictCallback = (typeof conflictCallback == FUNCTION);
            while (i--) {
                entry = entries[i];
                key = entry[0];
                value = entry[1];

                // Check for a conflict. The default behaviour is to overwrite the value for an existing key
                if ( hasConflictCallback && (thisValue = this.get(key)) ) {
                    value = conflictCallback(key, thisValue, value);
                }
                this.put(key, value);
            }
        },

        clone: function() {
            var clone = new Hashtable(this.properties);
            clone.putAll(this);
            return clone;
        }
    };

    Hashtable.prototype.toQueryString = function() {
        var entries = this.entries(), i = entries.length, entry;
        var parts = [];
        while (i--) {
            entry = entries[i];
            parts[i] = encodeURIComponent( toStr(entry[0]) ) + "=" + encodeURIComponent( toStr(entry[1]) );
        }
        return parts.join("&");
    };

    return Hashtable;
})();
var OSH = {
	version: 'dev'
};

function expose() {
	var oldOSH = window.OSH;
  
	OSH.noConflict = function () {
		window.OSH = oldOSH;
		return this;
	};

	window.OSH = OSH;
}
////////

var instance = null;

var STATE = {
  NONE: 0,
  BUFFERING : 1,
  READY:2
  
};

/**
 * The buffer is in charge of buffering data given a buffering parameter.
 * If this parameter is equals to 0, so the data are directly sent back
 */ 
var Buffer = function(){
	this.startCurrentTime = null;
	this.startDataTime = new Date().getTime();
	this.endDataTime = null;
	this.replayFactor = null;
	this.buffer = new Array();
	this.clientTable = new Hashtable();
	this.observers = new Array();
	this.bufferState = 0;
	this.bufferDelay = 0; // default buffering time in ms
  this.synchronized = true;
}

/**
 * Get a single instance of the buffer
 */ 
Buffer.getBufferSingleton = function() {
	if(instance == null){
		instance = new Buffer();
	}
	return instance;
}

/**
 * Set the buffering time before sending back the data to the corresponding client
 */ 
Buffer.prototype.setDelay = function(delay){
	this.bufferDelay = delay;
}

/**
 * Defines if the data has to be synchronized
 */ 
Buffer.prototype.setSynchronized = function(synchronize){
	this.synchronized = synchronize;
}

/**
 * Set the replay factor to compute the waiting time between two data (based on their timestamps)
 */  
Buffer.prototype.setReplayFactor = function(replayFactor){
  if(replayFactor <= 0 ) {
    //cannot be <= 0
    this.replayFactor = 1;
  }
	this.replayFactor = replayFactor;
}

/**
 * Add observer to be notified when a data is handling
 */
Buffer.prototype.addObserver = function(observerCB){
	this.observers.push(observerCB);
}

//buffering
/**
 * Push the data into buffer and process them. The observers are notified that a data just come here.
 * If a buffering time has been defined, the processing will start after.
 */ 
Buffer.prototype.push = function(id,data,timeStamp,name){
   var datum = {
		  id : id, 
		  data : data, 
		  timeStamp : timeStamp
	  }
	
  // pushes data into the buffer
	this.buffer.push(datum);
  
  // notifies the observers
  this.callbackObservers(id,name,timeStamp,data);
  
  // update the start data time if needed
  if(this.startDataTime > datum.timeStamp) {
    this.startDataTime = datum.timeStamp;
  }	
  
  // at the first buffer initialization
  if(this.bufferState == STATE.NONE) {
    // start buffering 
    this.bufferState = STATE.BUFFERING;
    this.start();
  }

  // the buffering is done, start to send back data to the corresponding clients
  if(this.bufferState == STATE.READY) {
    if(this.synchronized) {
      this.buffer.sort(function (a, b) {
          if (a.timeStamp > b.timeStamp) {
            return 1;
          }
          if (a.timeStamp < b.timeStamp) {
            return -1;
          }
          return 0;
      });
    }
    
    // the buffer is empty and the processNextData recursive method is finished, so process the data and start a new 
    // recursive loop
    if(this.buffer.length == 1) {
      this.processNextData();
    }
  } 
}

/**
 * Processes the data. Computes the time to wait between two data (based on timeStamp).
 */ 
Buffer.prototype.processNextData = function(){
  // computes the ellasped time
	var currentEllapsedTime = new Date().getTime() - this.startCurrentTime;
  // if the buffer has data
	if(this.buffer.length > 0) {
		var next = this.buffer[0];
    var waitTime = -1;
    if(this.synchronized) {
		  waitTime = (((next.timeStamp-this.startDataTime) / this.replayFactor) - currentEllapsedTime);
    }
  
    // this is not true in case of real time data    
    if(waitTime > 0) {
      //callback the data after waiting for a time equals to the difference between the two timeStamps
      window.setTimeout(function(){
        this.callbackData();
      }.bind(this),waitTime);
    } else {
        // in case of real time data, the data is callback directly
        this.callbackData();
    }
	} 
}

/**
 * Callback the data to the client. Once the data sent, the next one is processed.
 */
Buffer.prototype.callbackData = function(){
  // removes the first elements of buffer
	var next = this.buffer.shift();
	if(typeof(next) != 'undefined' && !isNaN(next.timeStamp)){
    // callback the data to the client
		this.clientTable.get(next.id)(next.data);
	}
  // recursive call
	this.processNextData();
}

/**
 * Callback stats to observers
 */ 
Buffer.prototype.callbackObservers = function(id,name,timeStamp,data) {
  if(this.observers.length > 0){
      //callback  to observers
      //var percent = ((timeStamp - this.startRealTime) * 100 ) / (this.endRealTime - this.startRealTime);
      for(var i = 0; i < this.observers.length; i++){
        var callback = this.observers[i];
        callback(
          {
           // percent : percent.toFixed(2),
            percent:0,
            name : name,
            id: id,
            timeStamp : timeStamp,
            received : new Date().getTime()
            //data : data //useless overload system
          }
        );
      }
	  }
}

/**
 *  Registers a new client
 */ 
Buffer.prototype.register = function(id,callback){
	this.clientTable.put(id,callback);
}

/**
 * Starts buffering data
 */ 
Buffer.prototype.start = function(){
	window.setTimeout(function(){
    this.bufferState = STATE.READY;
		this.startCurrentTime = new Date().getTime();
		this.processNextData();
	 }.bind(this),this.bufferDelay);
}

/**
 *  Resets all
 */
Buffer.prototype.reset = function(){
    this.bufferDelay = 0;
    this.startCurrentTime = new Date().getTime();
    this.bufferState = STATE.NONE;
		this.buffer = new Array();
}
var instanceController = null;

OSH.Controller = function() {
  this.table = new Hashtable();
  this.buffer = Buffer.getBufferSingleton();
  this.tableEvents = new Hashtable();
};

OSH.Controller.getSingleton = function() {
	if(instanceController == null){
		instanceController = new OSH.Controller();
	}
	return instanceController;
}

/**
 * Set the buffer mode:
 * - BUFFER_MODE.REPLAY is parametized by 
 * {
 *    startTime: value (Date),
 *    endTime: value (Date),
 *    replayFactor: value (number)
 * }
 * - BUFFER_MODE.REPLAY does not need any parameters
 */  
OSH.Controller.prototype.setOptions = function(params) {
    if(params.startTime) {
      this.buffer.setStartDate(params.startTime);
    }
    if(params.endTime) {
      this.buffer.setEndDate(params.endTime);
    }
    if(params.replayFactor) {
      this.buffer.setReplayFactor(params.replayFactor);
    }
    if(params.bufferingTime) {
      this.buffer.setDelay(params.bufferingTime);
    }
    if(params.synchronizedTime != 'undefined') {
      this.buffer.setSynchronized(params.synchronizedTime);
    }
};

/**
 * Add a data source into the controller. 
 * @param url: the WebSocket url
 * @param name: the name of the data source
 * @param timeStampParser: the time stamp parser. Because the buffer is using timeStamp to synchronized the data (in Replay Mode), 
 * the time stamp has to be defined and cannot be NULL
 * @param callback: the callback function by which the data is returned. It's the raw data from event.data of the WebSocket (including any timeStamp)
 */  
OSH.Controller.prototype.addDataSource = function(object,url,name,timeStampParser,callback){
  var uuid = getUUID();
  this.table.put(uuid,object);
  
  //creates Web Socket
  var ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  ws.onmessage = function(event) {
    if(event.data.byteLength > 0) {
      //push data onto the buffer. In the replay mode, the buffer will synchronize data before sending them back using
      //the callback method
      var timeStamp = new Date().getTime();
      
      if(timeStampParser != null) {
          //time stamp to synchronize the data
          timeStamp = timeStampParser(event.data);
      }
      
      this.buffer.push(uuid, event.data, timeStamp , name);
    }
  }.bind(this);
  ws.onerror = function(event) {
    ws.close();
  }
  
  this.buffer.register(uuid, callback);
  return uuid;
};

OSH.Controller.prototype.addDataSourceObserver = function(observer) {
  this.buffer.addObserver(observer);
};

function getUUID(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

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
        return ((infos.pts*1000)*this.timeScale)+this.absoluteTime; // FPS to FPMS
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
    infos.timeScale = 1/(infos.timeScale); // FPS
    pos += 4;
    
    //duration // 32 bits
    infos.duration = new DataView(data,pos,pos+4).getUint32(0); //4 bytes length
    pos += 4;
    
    //rate  // 32 bits / 65536
    infos.rate = (new DataView(data,pos,pos+4).getUint32(0));
    
    return infos;
}
OSH.Video = {
	version: 'dev'
};

window.OSH.Video = OSH.Video;

/**
 * The OSH.Video component is designed to decode and render video data.
 * Two format are supported for now: mp4 and mpeg.
 * The mpeg format uses the default blob and <img> tag implementation whereas the mp4 
 * format uses the Media Source Extended API and so the <video> tag.
 * The format can be specified as a constructor parameter as well as width and height such as:
 * params:{
 *  format:"mpeg"/"mp4",
 *  width:"500px",
 *  height:"500px"
 * }
 * The default width is 640 and height 480
 * The div parameter will be use to attach the corresponding tag to display video data.
 * 
 */
var self = null;

OSH.Video = function(options) {
    self = this;
    // sets mp4 as default format
    this.format = "mp4";
    this.width = "640px";
    this.height = "480px";
    this.div = "body";
    
    if(options.width) {
        this.width = options.width;
    }  
    if(options.height) {
        this.height = options.height;
    }
    if(options.div) {
        this.div = options.div;
    }
    
    // sets mpeg mpeg format if specified
    if(options.format && options.format == "mpeg") {
        this.format = "mpeg";
    } 

    var subParams = {
        width:this.width,
        height:this.height
    }

    if(this.format  == "mpeg") {
      this.video = new OSH.Video.Mpeg(document.getElementById(this.div),subParams);
    } else if(this.format == "mp4") {
      this.video = new OSH.Video.Mp4(document.getElementById(this.div),subParams);
      this.timeStampParser = new OSH.TimeStampParser.VideoMP4();
    }
};

OSH.Video.prototype.parseTimeStamp = function(data) {
    //TODO: find a way to keep "this" reference to use function assignment into constructor and avoid
    //this test
    //cannot assign a function directly without loosing this reference.
    if(self.format  == "mpeg") {
      return OSH.TimeStampParser.parseMpegVideo(data);
    } else if(self.format == "mp4") {
      return self.timeStampParser.parse(data);
    }
}

OSH.Video.prototype.onDataCallback = function(data) {
    self.video.onDataCallback(data);
};

//------------ MP4 -------------------/

OSH.Video.Mp4 = function(div,options) {
    // creates video tag element
    this.video = document.createElement("video");
    this.video.setAttribute("height", options.height);
    this.video.setAttribute("width", options.width);
    // appends <video> tag to <div>
    div.appendChild(this.video);
    
    // creates MediaSource object
    this.mediaSource = new MediaSource();
    this.buffer = null;
    this.queue = [];
    
    this.video.src = window.URL.createObjectURL(this.mediaSource);
    
    this.mediaSource.addEventListener('sourceopen', function(e) {
      this.mediaSource.duration = 10000000;
      this.video.play();

      this.buffer = this.mediaSource.addSourceBuffer('video/mp4; codecs="avc1.64001E"');

      this.buffer.addEventListener('updatestart', function(e) { /*console.log('updatestart: ' + mediaSource.readyState); */});
      this.buffer.addEventListener('update', function(e) { /*console.log('update: ' + mediaSource.readyState); */});
      this.buffer.addEventListener('updateend', function(e) { /*console.log('updateend: ' + mediaSource.readyState); */});
      this.buffer.addEventListener('error', function(e) { /*console.log('error: ' + mediaSource.readyState); */});
      this.buffer.addEventListener('abort', function(e) { /*console.log('abort: ' + mediaSource.readyState); */});

      this.buffer.addEventListener('update', function() { // Note: Have tried 'updateend'
        if(this.queue.length > 0 && !this.buffer.updating) {
          this.buffer.appendBuffer(this.queue.shift());
        }
      }.bind(this));
    }.bind(this), false);

    this.mediaSource.addEventListener('sourceopen', function(e) { /*console.log('sourceopen: ' + mediaSource.readyState); */});
    this.mediaSource.addEventListener('sourceended', function(e) { /*console.log('sourceended: ' + mediaSource.readyState); */});
    this.mediaSource.addEventListener('sourceclose', function(e) { /*console.log('sourceclose: ' + mediaSource.readyState); */});
    this.mediaSource.addEventListener('error', function(e) { console.log('error: ' + this.mediaSource.readyState); });
};

OSH.Video.Mp4.prototype.onDataCallback = function(data) {
    if (this.buffer.updating || this.queue.length > 0) {
      this.queue.push(data);
    } else {
      this.buffer.appendBuffer(data);
    }
};

//------------   MPEG -----------------//
OSH.Video.Mpeg = function(div,options) {
  // creates video tag element
  this.imgTag = document.createElement("img");
  this.imgTag.setAttribute("height", options.height);
  this.imgTag.setAttribute("width", options.width);
  // appends <img> tag to <div>
  div.appendChild(this.imgTag);
};

OSH.Video.Mpeg.prototype.onDataCallback = function(data) {
  var imgBlob = new Blob([data]);
  var blobURL = window.URL.createObjectURL(imgBlob.slice(12));
  var oldBlobURL = this.imgTag.src;
  this.imgTag.src = blobURL;
  window.URL.revokeObjectURL(oldBlobURL);
};
