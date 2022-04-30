"use strict";

const path = require("path");
const {list_all_files} = require("./walk");
const {create_record_from_path} = require("./records");

let missing_files = [];
let new_files = [];

const DELETION_BATCH_SIZE = 5;							// Ugh delete is so slow
const ADDITION_BATCH_SIZE = 200;

exports.update_database = function() {

	if (global.updating) {
		return;
	}

	global.updating = true;

	// ----------------------------------------------------------------------------------------

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

	setTimeout(continue_work, 25);
};

function continue_work() {

	document.getElementById("count").innerHTML = `In progress, ${missing_files.length + new_files.length} updates remaining...`;

	if (missing_files.length > 0) {
		continue_deletions();
		setTimeout(continue_work, 25);
	} else if (new_files.length > 0) {
		continue_additions();
		setTimeout(continue_work, 25);
	} else {
		global.updating = false;
		document.getElementById("count").innerHTML = `Update finished`;
	}

}

function continue_deletions() {

	let st = db.prepare(`DELETE FROM Games WHERE path = ? and filename = ?`);

	let delete_missing = db.transaction(() => {
		for (let filepath of missing_files.slice(0, DELETION_BATCH_SIZE)) {
			st.run(path.dirname(filepath), path.basename(filepath));
		}
	});

	delete_missing();

	if (missing_files.length > DELETION_BATCH_SIZE) {
		missing_files = missing_files.slice(DELETION_BATCH_SIZE);
	} else {
		missing_files = [];
	}

}

function continue_additions() {

	let st = db.prepare(`
		INSERT INTO Games (
			path,
			filename,
			dyer,
			SZ,
			HA,
			PB,
			PW,
			BR,
			WR,
			RE,
			DT,
			EV
		) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )
	`);

	let add_new = db.transaction(() => {

		for (let filepath of new_files.slice(0, ADDITION_BATCH_SIZE)) {

			let record;

			try {
				record = create_record_from_path(filepath);
			} catch (err) {
				console.log(err);
				continue;
			}
			
			st.run(
				record.path,
				record.filename,
				record.dyer,
				record.SZ,
				record.HA,
				record.PB,
				record.PW,
				record.BR,
				record.WR,
				record.RE,
				record.DT,
				record.EV
			);
		}
	});

	add_new();

	if (new_files.length > ADDITION_BATCH_SIZE) {
		new_files = new_files.slice(ADDITION_BATCH_SIZE);
	} else {
		new_files = [];
	}
}
