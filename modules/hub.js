"use strict";

const {ipcRenderer} = require("electron");
const config_io = require("./config_io");
const {list_all_files} = require("./walk");

function init() {
	let hub_prototype = {};
	Object.assign(hub_prototype, hub_main_props);
	Object.assign(hub_prototype, require("./hub_settings"));
	return Object.create(hub_prototype);
}

let hub_main_props = {

	quit: function() {
		config_io.save();					// As long as we use the sync save, this will complete before we
		ipcRenderer.send("terminate");		// send "terminate". Not sure about results if that wasn't so.
	},

	compare: function() {

		let db_set = Object.create(null);

		let st = db.prepare("SELECT path, filename FROM Games");
		let db_objects = st.all();

		for (let o of db_objects) {
			db_set[o.path + "/" + o.filename] = true;		// Not using path.join(), we want to consistently join with "/"
		}

		// ----------------------------------------------------------------------------------------
		
		let file_set = Object.create(null);

		let files = list_all_files(config.sgfdirs);

		for (let f of files) {
			file_set[f] = true;
		}

		// ----------------------------------------------------------------------------------------

		let new_files = [];
		let missing_files = [];

		for (let key of Object.keys(db_set)) {
			if (!file_set[key]) {
				missing_files.push(key);
			}
		}

		for (let key of Object.keys(file_set)) {
			if (!db_set[key]) {
				new_files.push(key);
			}
		}

		console.log("Missing files: ", missing_files);
		console.log("New files: ", new_files);
	},

};



module.exports = init();
