"use strict";

const { ipcRenderer, shell } = require("electron");
const fs = require("fs");

const config_io = require("./config_io");
const db = require("./db");
const new_node = require("./node");
const set_thumbnail = require("./thumbnail");
const load_sgf = require("./load_sgf");
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

		if (typeof config.sgfdir !== "string" || config.sgfdir === "") {
			this.display_no_connection();
			return;
		}

		db.connect();
		this.count_rows();

	},

	update_db: function() {
		if (!db.current()) {
			this.display_no_connection();
			return;
		}
		db.update();
	},

	stop_update: function() {
		if (!db.current()) {
			this.display_no_connection();
			return;
		}
		db.stop_update();
		this.count_rows();
	},

	reset_db: function() {
		if (!db.current()) {
			this.display_no_connection();
			return;
		}
		db.drop_table();
		this.count_rows();
	},

	count_rows: function() {
		if (!db.current()) {
			this.display_no_connection();
			return;
		}
		let st = db.current().prepare(`SELECT COUNT(*) FROM Games`);
		let count = st.get()["COUNT(*)"];
		document.getElementById("status").innerHTML = `Database has ${count} entries - ${config.sgfdir}`;
	},

	search: function() {

		if (!db.current()) {
			this.display_no_connection();
			return;
		}

		this.lookups = [];

		let pth = "%" + document.getElementById("pth").value + "%";
		let fname = "%" + document.getElementById("fname").value + "%";
		let dyer = "%" + document.getElementById("dyer").value + "%";

		let P1 = "%" + document.getElementById("P1").value + "%";
		let P2 = "%" + document.getElementById("P2").value + "%";
		let DT = "%" + document.getElementById("DT").value + "%";
		let EV = "%" + document.getElementById("EV").value + "%";
		let RO = "%" + document.getElementById("RO").value + "%";

		let st = db.current().prepare(`
			SELECT * FROM Games WHERE
				(path like ?)
					and
				(filename like ?)
					and
				(dyer like ?)
					and
				((PB like ? and PW like ?) or (PB like ? and PW like ?))
					and
				(DT like ?)
					and
				(EV like ?)
					and
				(RO like ?)
		`);

		let iterator = st.iterate(pth, fname, dyer, P1, P2, P2, P1, DT, EV, RO);

		let records = [];
		let truncated = false;

		for (let o of iterator) {
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
			this.lookups.push(record.path + "/" + record.filename);
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

		// Note: this.preview_node must end up being a valid node, never null.

		if (this.preview_path === new_preview_path) {
			return;
		}

		this.preview_node.destroy_tree();

		if (typeof new_preview_path === "string") {
			try {
				this.preview_node = load_sgf(fs.readFileSync(new_preview_path));
				this.preview_path = new_preview_path;
			} catch (err) {
				console.log("While trying to set preview:", err.toString());
				this.preview_node = new_node();
				this.preview_path = null;
			}
		} else {
			this.preview_node = new_node();
			this.preview_path = null;
		}

		for (let depth = 0; depth < config.preview_depth; depth++) {
			if (this.preview_node.children.length > 0) {
				this.preview_node = this.preview_node.children[0];
			} else {
				break;
			}
		}

		set_thumbnail(this.preview_node);
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
