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
