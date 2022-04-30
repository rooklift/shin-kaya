"use strict";

const {ipcRenderer} = require("electron");
const path = require("path");

const config_io = require("./config_io");
const {list_all_files} = require("./walk");
const {create_record_from_path, sort_records} = require("./records");
const {pad_or_slice} = require("./utils");

function init() {
	let hub_prototype = {};
	Object.assign(hub_prototype, hub_main_props);
	Object.assign(hub_prototype, require("./hub_settings"));
	return Object.create(hub_prototype);
}

let hub_main_props = {

	quit: function() {
		config_io.save();					// As long as we use the sync save, this will complete before we
		ipcRenderer.send("terminate");		// send "terminate". Not sure about results if that wasn't so.
	},

	update_db: function() {

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

		let new_files = [];
		let missing_files = [];

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

		// ----------------------------------------------------------------------------------------

		st = db.prepare(`DELETE FROM Games WHERE path = ? and filename = ?`);

		let delete_missing = db.transaction(() => {
			for (let filepath of missing_files) {
				st.run(path.dirname(filepath), path.basename(filepath));
			}
		});

		delete_missing();

		// ----------------------------------------------------------------------------------------

		st = db.prepare(`
			INSERT INTO Games (
				path,
				filename,
				dyer,
				canonicaldate,
				SZ,
				HA,
				PB,
				PW,
				BR,
				WR,
				RE,
				DT,
				EV
			) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )
		`);

		let i = 0;

		let add_new = db.transaction(() => {

			for (let filepath of new_files) {

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
					record.canonicaldate,
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

				if (i++ % 1000 === 0) {
					console.log(i);
				}
			}
		});

		add_new();

		console.log("Missing files: ", missing_files.length);
		console.log("New files: ", new_files.length);
	},

	search: function() {

		let P1 = "%" + document.getElementById("P1").value + "%";
		let P2 = "%" + document.getElementById("P2").value + "%";
		let EV = "%" + document.getElementById("EV").value + "%";

		let st = db.prepare(`
			SELECT
				path, filename, dyer, canonicaldate, PB, PW, BR, WR, RE, HA, EV, DT, SZ
			FROM
				Games
			WHERE
				(
					(PB like ? and PW like ?) or (PB like ? and PW like ?)
				) AND (
					EV like ?
				)
		`);

		let results = st.all(P1, P2, P2, P1, EV);

		// TODO deduplicate here

		sort_records(results);

		gamesbox.innerHTML = "";

		let lines = [];

		for (let result of results) {

			let result_direction = "? ";
			if (result.RE.startsWith("B+")) result_direction = "> ";
			if (result.RE.startsWith("W+")) result_direction = "< ";

			lines.push(
				"<span>" + 
				pad_or_slice(result.canonicaldate, 20) +
				" " +
				pad_or_slice(result.RE, 8) +
				" " +
				pad_or_slice(`${result.PB} ${result.BR}`, 24) + 
				" " +
				result_direction +
				" " +
				pad_or_slice(`${result.PW} ${result.WR}`, 24) +
				" " +
				pad_or_slice(result.EV, 64) +
				"</span>"
			);
		}

		document.getElementById("count").innerHTML = `${results.length} ${results.length === 1 ? "game" : "games"} shown`;

		gamesbox.innerHTML = lines.join("\n");

	},

};



module.exports = init();
