"use strict";

// This file contains stuff for connecting to database, as well as code that handles the
// slightly tricky business of updating a database. It does not deal with normal queries.

const fs = require("fs");
const path = require("path");
const sql = require("better-sqlite3");
const {list_all_files} = require("./walk");
const {create_record_from_path} = require("./records");

const DELETION_BATCH_SIZE = 5;			// Ugh delete is so slow
const ADDITION_BATCH_SIZE = 47;

let current_db = null;

let missing_files = [];					// These 2 arrays should only be non-empty iff there is an update in progress.
let new_files = [];

let work_timeout_id = null;				// Return val from setTimeout, so we can cancel any work in progress.

// ------------------------------------------------------------------------------------------------

exports.current = function() {
	return current_db;
};

exports.connect = function() {			// Using config.sgfdir

	exports.stop_update();
	exports.close();

	if (typeof config.sgfdir !== "string" || !fs.existsSync(config.sgfdir)) {
		config.sgfdir = null;
		return;
	}

	current_db = sql(path.join(config.sgfdir, "shinkaya.db"));
	create_table();
};

exports.close = function() {

	exports.stop_update();

	if (current_db) {
		current_db.close();
		current_db = null;
	}
};

exports.drop_table = function() {

	exports.stop_update();

	let st = current_db.prepare(`DROP TABLE Games`);
	st.run();
	
	create_table();
};

// ------------------------------------------------------------------------------------------------

function create_table() {
	try {
	    let st = current_db.prepare(`CREATE TABLE Games (
	        path text,
	        filename text,
	        dyer text,
	        SZ int,
	        HA int,
	        PB text,
	        PW text,
	        BR text,
	        WR text,
	        RE text,
	        DT text,
	        EV text)`
	    );
		st.run();
	} catch (err) {
		// It already exists
	}
}

// ------------------------------------------------------------------------------------------------
// Update code...

exports.stop_update = function() {

	if (work_timeout_id !== null) {
		clearTimeout(work_timeout_id);
		work_timeout_id = null;
	}

	missing_files = [];
	new_files = [];
};

exports.update = function() {

	if (!current_db) {
		return;
	}

	if (work_timeout_id !== null) {						// Work is already happening
		return;
	}

	document.getElementById("count").innerHTML = `Updating, this may take some time...`;

	// Start the work in a timeout so the page has a chance to update with the message.

	work_timeout_id = setTimeout(() => {
		work_timeout_id = null;
		really_update();
	}, 5);
};

function really_update() {

	// Make a set of all known files in the database...

	let db_set = Object.create(null);
	let st = current_db.prepare("SELECT path, filename FROM Games");
	let db_objects = st.all();
	for (let o of db_objects) {
		db_set[o.path + "/" + o.filename] = true;		// Not using path.join(), we want to consistently join with "/"
	}

	// Make a set of all files in the directory...
	
	let file_set = Object.create(null);
	let files = list_all_files(config.sgfdir);
	for (let f of files) {
		file_set[f] = true;
	}

	// Make the diffs...

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

	// Schedule the work...

	if (missing_files.length > 0 || new_files.length > 0) {
		work_timeout_id = setTimeout(() => {
			work_timeout_id = null;
			continue_work(current_db);
		}, 5);
	} else {
		document.getElementById("count").innerHTML = `No changes made`;
	}
};

function continue_work(database) {

	if (database !== current_db) {
		throw new Error("continue_work(): database changed unexpectedly");
	}

	document.getElementById("count").innerHTML = `In progress, ${missing_files.length + new_files.length} updates remaining...`;

	if (missing_files.length > 0) {
		continue_deletions();
	} else if (new_files.length > 0) {
		continue_additions();
	} else {
		throw new Error("continue_work(): file arrays were empty");
	}

	if (missing_files.length > 0 || new_files.length > 0) {
		work_timeout_id = setTimeout(() => {
			work_timeout_id = null;
			continue_work(database);
		}, 5);
	} else {
		document.getElementById("count").innerHTML = `Update completed`;
	}

}

function continue_deletions() {

	let st = current_db.prepare(`DELETE FROM Games WHERE path = ? and filename = ?`);

	let delete_missing = current_db.transaction(() => {
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

	let st = current_db.prepare(`
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

	let add_new = current_db.transaction(() => {

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
