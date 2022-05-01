"use strict";

const {ipcRenderer, shell} = require("electron");

const config_io = require("./config_io");
const db = require("./db");
const {new_board, board_from_path} = require("./board");
const thumbnail = require("./thumbnail");
const {sort_records, deduplicate_records} = require("./records");
const {pad_or_slice} = require("./utils");

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

		let P1 = "%" + document.getElementById("P1").value + "%";
		let P2 = "%" + document.getElementById("P2").value + "%";
		let EV = "%" + document.getElementById("EV").value + "%";
		let DT = "%" + document.getElementById("DT").value + "%";
		let pth = "%" + document.getElementById("pth").value + "%";
		let fname = "%" + document.getElementById("fname").value + "%";
		let dyer = "%" + document.getElementById("dyer").value + "%";

		let st = db.current().prepare(`
			SELECT
				path, filename, dyer, PB, PW, BR, WR, RE, HA, EV, DT, SZ
			FROM
				Games
			WHERE
				(
					(PB like ? and PW like ?) or (PB like ? and PW like ?)
				) AND (
					EV like ?
				) AND (
					DT like ?
				) AND (
					path like ?
				) AND (
					filename like ?
				) AND (
					dyer like ?
				)
		`);

		let iterator = st.iterate(P1, P2, P2, P1, EV, DT, pth, fname, dyer);

		let records = [];
		let truncated = false;

		for (let o of iterator) {
			records.push(o);
			if (records.length >= 9999) {
				truncated = true;
				break;
			}
		};

		let dedup_count = 0;

		if (config.deduplicate) {
			let length_before = records.length;
			deduplicate_records(records);
			dedup_count = length_before - records.length;
		}
		sort_records(records);

		gamesbox.innerHTML = "";

		let lines = [];

		for (let [i, record] of records.entries()) {

			let result_direction = " ? ";
			if (record.RE.startsWith("B+")) result_direction = " > ";
			if (record.RE.startsWith("W+")) result_direction = " < ";

			let element_id = `gamesbox_entry_${i}`;
			let ha_string = (record.HA >= 2) ? "(H" + record.HA.toString() + ")" : "";

			lines.push(
				`<span id="${element_id}" class="game">` + 
				pad_or_slice(record.DT, 12) +
				" " +
				pad_or_slice(record.RE, 8) +
				" " +
				pad_or_slice(`${record.PB} ${record.BR}`, 26) + 
				" " +
				result_direction +
				" " +
				pad_or_slice(`${record.PW} ${record.WR}`, 26) +
				" " +
				pad_or_slice(ha_string, 5) + 
				" " +
				pad_or_slice(record.EV, 128) +
				"</span>"
			);

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

		gamesbox.innerHTML = lines.join("\n");

	},

	set_preview_from_index: function(n) {			// Or can also pass null to set the empty preview

		let fullpath = null;
		let board = null;

		if (typeof n === "number" && !Number.isNaN(n) && n >= 0 && n < this.lookups.length) {
			fullpath = this.lookups[n];
			board = board_from_path(fullpath);
		} else {
			board = new_board(19, 19);
		}

		let o = thumbnail(board);
		document.getElementById("preview").src = o.data;
		this.preview_path = fullpath;
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