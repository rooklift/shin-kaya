"use strict";

const fs = require("fs");
const sql = require("better-sqlite3");

const slashpath = require("./slashpath");
const { list_all_files } = require("./walk_promise");
const { create_record_from_path } = require("./records");

const DELETION_BATCH_SIZE = 5;			// Ugh delete is so slow
const ADDITION_BATCH_SIZE = 47;

let current_db = null;
let work_in_progress = false;

exports.current = function() {
	return current_db;
};

exports.wip = function() {
	return work_in_progress;
};

exports.connect = function() {			// Using config.sgfdir

	if (work_in_progress) {
		throw new Error("connect() called while work in progress");
	}

	if (current_db) {
		current_db.close();
		current_db = null;
	}

	if (typeof config.sgfdir !== "string" || !fs.existsSync(config.sgfdir)) {
		config.sgfdir = null;
		return;
	}

	current_db = sql(slashpath.join(config.sgfdir, "shin-kaya.db"));
	maybe_create_table();
};

exports.drop_table = function() {

	if (work_in_progress) {
		alert("Unable. Work is in progress.");
		return;
	}

	if (current_db) {
		let st = current_db.prepare(`DROP TABLE Games`);
		st.run();
		st = current_db.prepare(`vacuum`);
		st.run();
		maybe_create_table();
	}
}

function maybe_create_table() {

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

exports.stop_update = function() {
	work_in_progress = false;
}

exports.update = function() {

	// The only export that returns a promise. Resolves with {additions, deletions}.
	// The only export that adjusts work_in_progress.

	if (!current_db) {
		return Promise.reject(new Error("update(): No database."));
	}

	if (work_in_progress) {
		return Promise.reject(new Error("update(): Work is in progress."));
	}

	work_in_progress = true;
	return update_promise_1(current_db, config.sgfdir).finally(() => {
		work_in_progress = false;
	});
}

function update_promise_1(database, archivepath) {

	if (database !== current_db) {
		return Promise.reject(new Error("update_promise_1(): database changed unexpectedly"));
	}

	// Make a set of all known files in the database.
	// Like all better-sqlite3 ops, this is sync...

	let db_set = Object.create(null);
	let st = database.prepare("SELECT relpath FROM Games");
	let db_objects = st.all();
	for (let o of db_objects) {
		db_set[o.relpath] = true;
	}

	// Do the async file-walk and then continue...

	return list_all_files(archivepath, "").then(files => {
		return update_promise_2(database, archivepath, db_set, files);
	});
}

function update_promise_2(database, archivepath, db_set, files) {

	if (database !== current_db) {
		return Promise.reject(new Error("update_promise_2(): database changed unexpectedly"));
	}

	let file_set = Object.create(null);
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

	if (missing_files.length === 0 && new_files.length === 0) {
		return Promise.reject(new Error("update_promise_2(): No additions or deletions."))
	}

	return new Promise((resolve, reject) => {
		continue_work(resolve, reject, database, archivepath, missing_files, new_files, 0, 0);
	});
}

function continue_work(resolve, reject, database, archivepath, missing_files, new_files, missing_off, new_off) {

	if (database !== current_db) {
		reject(new Error("continue_work(): database changed unexpectedly"));
		return;
	}

	if (work_in_progress === false) {
		reject(new Error("continue_work(): aborted by user"));
		return;
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

	if (missing_off >= missing_files.length && new_off >= new_files.length) {
		resolve({additions: new_files.length, deletions: missing_files.length});
		return;
	}

	setTimeout(() => {
		continue_work(resolve, reject, current_db, archivepath, missing_files, new_files, missing_off, new_off);
	}, 5);
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

