"use strict";

const { ipcRenderer } = require("electron");
const db = require("./db_promises");

const multichecks = {
	"preview_depth":		["View", "Preview depth (initial)"]
};
const togglechecks = {
	"apply_gogod_fixes": 	["Database", "Fix (most) GoGoD names on import"],
	"deduplicate":			["View", "Deduplicate search results"]
};

for (let menupath of Object.values(multichecks)) {
	ipcRenderer.send("verify_menupath", menupath);
}

for (let menupath of Object.values(togglechecks)) {
	ipcRenderer.send("verify_menupath", menupath);
}

module.exports = {

	set: function(key, value) {

		let old_value = config[key];
		config[key] = value;

		switch (key) {

			case "sgfdir":

				if (db.wip()) {
					config[key] = old_value;
					alert("Unable. Work is in progress.");
				} else {
					db.connect();
					this.display_row_count();
				}
				break;
		}

		if (multichecks.hasOwnProperty(key)) {
			ipcRenderer.send("set_checks", multichecks[key].concat([value]));
		}

		if (togglechecks.hasOwnProperty(key)) {
			ipcRenderer.send(value ? "set_check_true" : "set_check_false", togglechecks[key]);
		}

	},

};
