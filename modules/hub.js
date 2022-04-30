"use strict";

const {ipcRenderer} = require("electron");

const config_io = require("./config_io");
const {sort_records, deduplicate_records} = require("./records");
const {pad_or_slice} = require("./utils");
const {update_database} = require("./update");

function init() {

	let hub_prototype = {};
	Object.assign(hub_prototype, hub_main_props);
	Object.assign(hub_prototype, require("./hub_settings"));

	let ret = Object.create(hub_prototype);
	ret.lookups = Object.create(null);		// element id --> fullpath

	return ret;
}

let hub_main_props = {

	quit: function() {
		config_io.save();					// As long as we use the sync save, this will complete before we
		ipcRenderer.send("terminate");		// send "terminate". Not sure about results if that wasn't so.
	},

	update_db: function() {
		update_database();
	},

	search: function() {

		this.lookups = Object.create(null);

		let P1 = "%" + document.getElementById("P1").value + "%";
		let P2 = "%" + document.getElementById("P2").value + "%";
		let EV = "%" + document.getElementById("EV").value + "%";
		let DT = "%" + document.getElementById("DT").value + "%";
		let pth = "%" + document.getElementById("pth").value + "%";
		let fname = "%" + document.getElementById("fname").value + "%";
		let dyer = "%" + document.getElementById("dyer").value + "%";

		let st = db.prepare(`
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

			let result_direction = "? ";
			if (record.RE.startsWith("B+")) result_direction = "> ";
			if (record.RE.startsWith("W+")) result_direction = "< ";

			let element_id = `gamesbox_entry_${i}`;

			this.lookups[element_id] = record.path + "/" + record.filename;

			lines.push(
				`<span id="${element_id}" class="game">` + 
				pad_or_slice(record.DT, 12) +
				" " +
				pad_or_slice(record.RE, 8) +
				" " +
				pad_or_slice(`${record.PB} ${record.BR}`, 24) + 
				" " +
				result_direction +
				" " +
				pad_or_slice(`${record.PW} ${record.WR}`, 24) +
				" " +
				pad_or_slice(record.EV, 64) +
				"</span>"
			);
		}

		let count_string = `${records.length} ${records.length === 1 ? "game" : "games"} shown`;

		if (dedup_count > 0) {
			count_string += `;  deduplicated ${dedup_count} ${dedup_count === 1 ? "game" : "games"}`;
		}

		if (truncated) {
			count_string += `;  too many results`;
		}

		document.getElementById("count").innerHTML = count_string;

		gamesbox.innerHTML = lines.join("\n");

	},

};



module.exports = init();
