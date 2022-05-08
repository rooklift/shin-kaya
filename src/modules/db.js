"use strict";

// This file contains stuff for connecting to database, as well as code that handles the
// slightly tricky business of updating a database. It does not deal with normal queries.

const fs = require("fs");
const sql = require("better-sqlite3");

const slashpath = require("./slashpath");
const { list_all_files } = require("./walk");
const { create_record_from_path } = require("./records");

const DELETION_BATCH_SIZE = 5;			// Ugh delete is so slow
const ADDITION_BATCH_SIZE = 47;

let current_db = null;

let work_timeout_id = null;				// Return val from setTimeout, so we can cancel any work in progress.

// ------------------------------------------------------------------------------------------------

exports.current = function() {
	return current_db;
};

exports.connect = function() {			// Using config.sgfdir

	exports.stop_update();

	if (current_db) {
		current_db.close();
		current_db = null;
	}

	if (typeof config.sgfdir !== "string" || !fs.existsSync(config.sgfdir)) {
		config.sgfdir = null;
		return;
	}

	current_db = sql(slashpath.join(config.sgfdir, "shin-kaya.db"));
	create_table();
};

exports.drop_table = function() {

	exports.stop_update();

	if (current_db) {
		let st = current_db.prepare(`DROP TABLE Games`);
		st.run();
		st = current_db.prepare(`vacuum`);
		st.run();
		create_table();
	}
};

// ------------------------------------------------------------------------------------------------
// If this gets changed, must also change create_record() and continue_additions()

function create_table() {

	if (!current_db) {
		return;
	}

	try {
		let st = current_db.prepare(
		`CREATE TABLE Games (
			relpath   text,
			dyer      text,
			movecount int,
			SZ        int,
			HA        int,
			PB        text,
			PW        text,
			BR        text,
			WR        text,
			RE        text,
			DT        text,
			EV        text,
			RO        text)`
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
};

exports.update = function() {

	if (!current_db) {
		return;
	}

	if (work_timeout_id !== null) {						// Work is already happening
		return;
	}

	document.getElementById("status").innerHTML = `Updating, this may take some time...`;

	// Start the work in a timeout so the page has a chance to update with the message.

	work_timeout_id = setTimeout(() => {
		work_timeout_id = null;
		really_update(current_db, config.sgfdir);
	}, 5);
};

function really_update(database, archivepath) {

	if (database !== current_db) {
		throw new Error("really_update(): database changed unexpectedly");
	}

	// Make a set of all known files in the database...

	let db_set = Object.create(null);
	let st = current_db.prepare("SELECT relpath FROM Games");
	let db_objects = st.all();
	for (let o of db_objects) {
		db_set[o.relpath] = true;
	}

	// Make a set of all files in the directory...
	
	let file_set = Object.create(null);
	let files = list_all_files(archivepath, "");
	for (let f of files) {
		file_set[f] = true;
	}

	// Make the diffs...

	let missing_files = [];
	let new_files = [];

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
			continue_work(current_db, archivepath, missing_files, new_files, 0, 0);
		}, 5);
	} else {
		document.getElementById("status").innerHTML = `No changes made`;
	}
}

function continue_work(database, archivepath, missing_files, new_files, missing_off, new_off) {

	if (database !== current_db) {
		throw new Error("continue_work(): database changed unexpectedly");
	}

	if (missing_off < missing_files.length) {
		document.getElementById("status").innerHTML = `In progress, ${missing_files.length - missing_off} deletions remaining...`;
		continue_deletions(missing_files.slice(missing_off, missing_off + DELETION_BATCH_SIZE));
		missing_off += DELETION_BATCH_SIZE;
	} else if (new_off < new_files.length) {
		document.getElementById("status").innerHTML = `In progress, ${new_files.length - new_off} additions remaining...`;
		continue_additions(archivepath, new_files.slice(new_off, new_off + ADDITION_BATCH_SIZE));
		new_off += ADDITION_BATCH_SIZE;
	} else {
		throw new Error("continue_work(): offsets indicated work was already complete");
	}

	if (missing_off < missing_files.length || new_off < new_files.length) {
		work_timeout_id = setTimeout(() => {
			work_timeout_id = null;
			continue_work(current_db, archivepath, missing_files, new_files, missing_off, new_off);
		}, 5);
	} else {
		document.getElementById("status").innerHTML = `Update completed - deletions: ${missing_files.length}, additions: ${new_files.length}`;
	}

}

function continue_deletions(arr) {

	let st = current_db.prepare(`DELETE FROM Games WHERE relpath = ?`);

	let delete_missing = current_db.transaction(() => {
		for (let relpath of arr) {
			st.run(relpath);
		}
	});

	delete_missing();
}

function continue_additions(archivepath, arr) {

	let st = current_db.prepare(`
		INSERT INTO Games (
			relpath, dyer, movecount, SZ, HA, PB, PW, BR, WR, RE, DT, EV, RO
		) VALUES (
			@relpath, @dyer, @movecount, @SZ, @HA, @PB, @PW, @BR, @WR, @RE, @DT, @EV, @RO
		)
	`);

	let add_new = current_db.transaction(() => {

		for (let relpath of arr) {

			let record;

			try {
				record = create_record_from_path(archivepath, relpath);
			} catch (err) {
				console.log(err);
				continue;
			}
			
			st.run(record);
		}
	});

	add_new();
}
