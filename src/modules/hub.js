"use strict";

const { ipcRenderer, shell } = require("electron");
const fs = require("fs/promises");

const config_io = require("./config_io");
const db = require("./db_promise");
const new_node = require("./node");
const set_thumbnail = require("./thumbnail");
const load_sgf = require("./load_sgf");
const slashpath = require("./slashpath");
const { new_board } = require("./board");
const { sort_records, deduplicate_records, span_string } = require("./records");

function init() {

	let hub_prototype = {};
	Object.assign(hub_prototype, hub_main_props);
	Object.assign(hub_prototype, require("./hub_settings"));

	let ret = Object.create(hub_prototype);
	ret.lookups = [];
	ret.preview_path = null;
	ret.preview_node = new_node();

	set_thumbnail(ret.preview_node);

	return ret;
}

let hub_main_props = {

	quit: function() {
		db.stop_update();
		config_io.save();					// As long as we use the sync save, this will complete before we
		ipcRenderer.send("terminate");		// send "terminate". Not sure about results if that wasn't so.
	},

	display_no_connection: function() {
		document.getElementById("status").innerHTML = `No database open`;
	},

	connect_db: function() {
		if (db.wip()) {
			alert("Unable. Work is in progress.");
			return;
		}
		db.connect();
		this.display_row_count();
	},

	update_db: function() {
		document.getElementById("status").innerHTML = `Updating, this may take some time...`;
		db.update().then(() => {
			document.getElementById("status").innerHTML = `Update completed - deletions: ${missing_files.length}, additions: ${new_files.length}`;
		}).catch(err => {
			document.getElementById("status").innerHTML = err.toString();
		});
	},

	stop_update: function() {
		db.stop_update();
		this.display_row_count();
	},

	reset_db: function() {
		if (db.wip()) {
			alert("Unable. Work is in progress.");
			return;
		}
		if (!db.current()) {
			this.display_no_connection();
			return;
		}
		db.drop_table();
		this.display_row_count();
	},

	display_row_count: function() {
		if (db.wip()) {
			alert("Unable. Work is in progress.");
			return;
		}
		if (!db.current()) {
			this.display_no_connection();
			return;
		}
		let st = db.current().prepare(`SELECT COUNT(*) FROM Games`);
		let count = st.get()["COUNT(*)"];
		document.getElementById("status").innerHTML = `Database has ${count} entries - ${config.sgfdir}`;
	},

	get_iterator: function() {

		if (!db.current()) {
			return [];
		}

		let binding = {
			relpath:  "%" + document.getElementById("relpath").value.trim() + "%",
			dyer:     "%" + document.getElementById("dyer").value.trim() + "%", 
			P1:       "%" + document.getElementById("P1").value.trim() + "%",
			P2:       "%" + document.getElementById("P2").value.trim() + "%",
			DT:       "%" + document.getElementById("DT").value.trim() + "%",
			EV:       "%" + document.getElementById("EV").value.trim() + "%",
			RO:       "%" + document.getElementById("RO").value.trim() + "%",
		};

		let st = db.current().prepare(`
			SELECT * FROM Games WHERE
				(relpath like @relpath)
					and
				(dyer like @dyer)
					and
				((PB like @P1 and PW like @P2) or (PB like @P2 and PW like @P1))
					and
				(DT like @DT)
					and
				(EV like @EV)
					and
				(RO like @RO)
		`);

		return st.iterate(binding);
	},

	get_all: function() {			// For debugging, returns the actual SQL records.

		if (db.wip()) {
			return null;
		}

		if (!db.current()) {
			return null;
		}

		let records = [];

		for (let o of this.get_iterator()) {
			records.push(o);
		}

		return records;
	},

	search: function() {

		if (db.wip()) {
			alert("Unable. Work is in progress.");
			return;
		}

		if (!db.current()) {
			this.display_no_connection();
			return;
		}

		this.lookups = [];

		let records = [];
		let truncated = false;

		for (let o of this.get_iterator()) {
			records.push(o);
			if (records.length >= 9999) {
				truncated = true;
				break;
			}
		}

		let dedup_count = 0;

		if (config.deduplicate) {
			let length_before = records.length;
			deduplicate_records(records);
			dedup_count = length_before - records.length;
		}

		sort_records(records);		// After the above deduplication, which also has an in-place sort during the process.

		let lines = [];

		for (let [i, record] of records.entries()) {
			lines.push(span_string(record, `gamesbox_entry_${i}`));
			this.lookups.push(slashpath.join(config.sgfdir, record.relpath));
		}

		let count_string = `<span class="bold">${records.length}</span> ${records.length === 1 ? "game" : "games"} shown`;

		if (dedup_count > 0) {
			count_string += `;  deduplicated ${dedup_count} ${dedup_count === 1 ? "game" : "games"}`;
		}

		if (truncated) {
			count_string += `;  too many results`;
		}

		document.getElementById("status").innerHTML = count_string;
		document.getElementById("gamesbox").innerHTML = lines.join("\n");

		this.set_preview_from_path(null);

	},

	set_preview_from_path: function(new_preview_path) {

		// Early aborts...

		if (this.preview_path === new_preview_path) {
			return;
		}

		if (typeof new_preview_path !== "string") {
			this.preview_node.destroy_tree();
			this.preview_node = new_node();
			this.preview_path = null;
			document.getElementById("path").innerHTML = "";
			set_thumbnail(this.preview_node);
			return;
		}

		// The main part of this function is async, on the theory that there may be a little lag time when
		// loading the file, which may feel unresponsive. Note this.preview_path is set instantly, so that we
		// can check whether it was changed (by another call to this function) while the file was loading...

		this.preview_path = new_preview_path;

		fs.readFile(new_preview_path).then(buf => {					// The read itself could throw.

			if (this.preview_path !== new_preview_path) {
				return;
			}

			let new_root = load_sgf(buf);							// This could throw.

			this.preview_node.destroy_tree();
			this.preview_node = new_root;

			for (let depth = 0; depth < config.preview_depth; depth++) {
				if (this.preview_node.children.length > 0) {
					this.preview_node = this.preview_node.children[0];
				} else {
					break;
				}
			}

		}).catch(err => {											// Reachable from the 2 throw locations, above.

			console.log("While trying to set preview:", err.toString());
			this.preview_node.destroy_tree();
			this.preview_node = new_node();
			this.preview_path = null;

		}).finally(() => {

			document.getElementById("path").innerHTML = slashpath.relative(config.sgfdir, new_preview_path);
			set_thumbnail(this.preview_node);

		});
	},

	set_preview_from_index: function(n) {
		if (typeof n === "number" && !Number.isNaN(n) && n >= 0 && n < this.lookups.length) {
			this.set_preview_from_path(this.lookups[n]);
		} else {
			this.set_preview_from_path(null);
		}
	},

	open_file_from_index: function(n) {
		if (typeof n === "number" && !Number.isNaN(n) && n >= 0 && n < this.lookups.length) {
			let fullpath = this.lookups[n];
			shell.openPath(fullpath);
		}
	},

	open_preview_file: function() {
		if (this.preview_path) {
			shell.openPath(this.preview_path);
		}
	},

	prev_node: function() {

		if (!this.preview_node.parent) {
			return;
		}

		this.preview_node = this.preview_node.parent;
		set_thumbnail(this.preview_node);
	},

	next_node: function() {

		if (this.preview_node.children.length === 0) {
			return;
		}

		this.preview_node = this.preview_node.children[0];
		set_thumbnail(this.preview_node);
	},

};



module.exports = init();
