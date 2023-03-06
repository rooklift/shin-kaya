"use strict";

const fs = require("fs");
const sql = require("better-sqlite3");

const slashpath = require("./slashpath");
const { list_all_files } = require("./walk_promises");
const { create_record_from_path } = require("./records");

const DELETION_BATCH_SIZE = 5;			// Ugh delete is so slow
const ADDITION_BATCH_SIZE = 47;

let current_db = null;
let work_in_progress = false;
let abort_flag = false;

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
	current_db.pragma("journal_mode = WAL");		// Apparently this is recommended.
	maybe_create_table();
};

exports.drop_table = function() {

	if (work_in_progress) {
		throw new Error("drop_table() called while work in progress");
	}

	if (current_db) {
		let st = current_db.prepare(`DROP TABLE Games`);
		st.run();
		st = current_db.prepare(`vacuum`);
		st.run();
		maybe_create_table();
	}
};

function maybe_create_table() {

	if (work_in_progress) {
		throw new Error("maybe_create_table() called while work in progress");
	}

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
	if (work_in_progress) {
		abort_flag = true;
	}
};

exports.update = function() {

	// The only export that returns a promise. Resolves with {additions, deletions}.

	if (!current_db) {
		return Promise.reject(new Error("update(): No database."));
	}

	if (work_in_progress) {
		return Promise.reject(new Error("update(): Work is in progress."));
	}

	work_in_progress = true;

	let database = current_db;
	let archivepath = config.sgfdir;
	
	return list_all_files(archivepath, "").then(files => {
		return main_update_promise(database, archivepath, make_db_set(database), files);
	}).finally(() => {
		work_in_progress = false;
		abort_flag = false;
	});
};

function make_db_set(database) {

	// Make a set of all known files in the database.
	// Like all better-sqlite3 ops, this is sync...

	if (database !== current_db) {
		throw new Error("make_db_set(): database changed unexpectedly");
	}

	let db_set = Object.create(null);
	let st = database.prepare("SELECT relpath FROM Games");
	let db_objects = st.all();
	for (let o of db_objects) {
		db_set[o.relpath] = true;
	}

	return db_set;
}

function main_update_promise(database, archivepath, db_set, files) {

	if (database !== current_db) {
		return Promise.reject(new Error("main_update_promise(): database changed unexpectedly"));
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
		return Promise.resolve({additions: 0, deletions: 0});
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

	if (abort_flag) {
		reject(new Error("continue_work(): aborted by user"));
		return;
	}

	if (missing_off < missing_files.length) {
		document.getElementById("status").innerHTML = `Deletions: ${missing_off} of ${missing_files.length}...`;
		continue_deletions(database, missing_files.slice(missing_off, missing_off + DELETION_BATCH_SIZE));
		missing_off += DELETION_BATCH_SIZE;
	} else if (new_off < new_files.length) {
		document.getElementById("status").innerHTML = `Additions: ${new_off} of ${new_files.length}...`;
		continue_additions(database, archivepath, new_files.slice(new_off, new_off + ADDITION_BATCH_SIZE));
		new_off += ADDITION_BATCH_SIZE;
	}

	if (missing_off >= missing_files.length && new_off >= new_files.length) {
		resolve({additions: new_files.length, deletions: missing_files.length});
		return;
	}

	setTimeout(() => {
		continue_work(resolve, reject, database, archivepath, missing_files, new_files, missing_off, new_off);
	}, 5);
}

function continue_deletions(database, arr) {

	let st = database.prepare(`DELETE FROM Games WHERE relpath = ?`);

	let delete_missing = database.transaction(() => {
		for (let relpath of arr) {
			st.run(relpath);
		}
	});

	delete_missing();
}

function continue_additions(database, archivepath, arr) {

	let st = database.prepare(`
		INSERT INTO Games (
			relpath, dyer, movecount, SZ, HA, PB, PW, BR, WR, RE, DT, EV, RO
		) VALUES (
			@relpath, @dyer, @movecount, @SZ, @HA, @PB, @PW, @BR, @WR, @RE, @DT, @EV, @RO
		)
	`);

	let add_new = database.transaction(() => {

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

