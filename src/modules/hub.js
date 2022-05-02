"use strict";

const {ipcRenderer, shell} = require("electron");

const config_io = require("./config_io");
const db = require("./db");
const {new_board, board_from_path} = require("./board");
const thumbnail = require("./thumbnail");
const {sort_records, deduplicate_records, span_string} = require("./records");

function init() {

	let hub_prototype = {};
	Object.assign(hub_prototype, hub_main_props);
	Object.assign(hub_prototype, require("./hub_settings"));

	let ret = Object.create(hub_prototype);
	ret.lookups = [];
	ret.preview_path = null;

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
			SELECT
				path, filename, dyer, SZ, HA, PB, PW, BR, WR, RE, DT, EV, RO
			FROM
				Games
			WHERE
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

		this.set_preview_from_index(null);

	},

	set_preview_from_index: function(n) {			// Or can also pass null to set the empty preview

		let highlighted = document.getElementsByClassName("highlightedgame")[0];
		if (highlighted) {
			highlighted.className = "";
		}

		if (typeof n === "number" && !Number.isNaN(n) && n >= 0 && n < this.lookups.length) {

			this.preview_path = this.lookups[n];

			let o = thumbnail(board_from_path(this.preview_path));
			document.getElementById("preview").src = o.data;

			let element_to_highlight = document.getElementById(`gamesbox_entry_${n}`);
			element_to_highlight.className = "highlightedgame";

		} else {

			this.preview_path = null;

			let o = thumbnail(new_board(19, 19));
			document.getElementById("preview").src = o.data;

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

};



module.exports = init();
