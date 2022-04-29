"use strict";

// Poll the window size; adjust our settings if needed. Does nothing if main.js has told us we are
// maxed (by setting config.maxed). There is a race condition here -- the spinner might run after
// the maximize but before hub has told us about it -- but meh.

(function window_resize_spinner() {

	if (!config.maxed) {

		if (config.width !== window.innerWidth || config.height !== window.innerHeight) {

			config.width = window.innerWidth;
			config.height = window.innerHeight;
			
		}
	}

	setTimeout(window_resize_spinner, 127);
	
})();
