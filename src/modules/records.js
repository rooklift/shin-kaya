"use strict";

const fs = require("fs");
const path = require("path");

const load_sgf = require("./load_sgf");
const { replace_all, safe_html, pad_or_slice } = require("./utils");

const gogod_name_fixes = require("./gogod_name_fixes");

function create_record(root, filepath) {

	let ret = {};

	// Strings...

	for (let key of ["EV", "RO", "PB", "PW", "BR", "WR"]) {
		ret[key] = root.get(key);										// get() returns "" if absent, which is what we want.
	}

	ret.DT = canonicaldate(root.get("DT"));
	ret.RE = canonicalresult(root.get("RE"));

	// Ints...

	for (let key of ["HA", "SZ"]) {

		let s = root.get(key);
		let i = parseInt(s, 10);

		if (!Number.isNaN(i)) {
			ret[key] = i;
		} else if (key === "SZ") {
			ret[key] = 19;
		} else {
			ret[key] = 0;
		}
	}

	ret.movecount = move_count(root);

	// Misc strings...
	
	ret.dyer = root.dyer();
	ret.path = path.dirname(filepath);									// path does not include filename
	ret.filename = path.basename(filepath);

	// For consistency, lets always use / as a path separator...

	if (global.process && global.process.platform === "win32") {
		ret.path = replace_all(ret.path, "\\", "/");
	}

	// Apply GoGoD name fixes...

	if (config.apply_gogod_fixes) {
		if (gogod_name_fixes[ret.PB]) ret.PB = gogod_name_fixes[ret.PB];
		if (gogod_name_fixes[ret.PW]) ret.PW = gogod_name_fixes[ret.PW];
	}

	return ret;
}

function move_count(root) {
	let node = root;
	let count = 0;
	while (true) {
		if (node.has_key("B") || node.has_key("W")) {
			count++;
		}
		if (node.children.length > 0) {
			node = node.children[0];
		} else {
			return count;
		}
	}
}

function create_record_from_path(filepath) {							// Can throw

	if (!fs.existsSync(filepath)) {
		throw new Error("No such file");
	}

	let buf = fs.readFileSync(filepath);								// Can throw (theoretically and maybe actually)
	let root = load_sgf(buf);											// Can throw

	return create_record(root, filepath);
}

function canonicaldate(DT) {

	let m;

	m = DT.match(/\d\d\d\d-\d\d-\d\d/g);
	if (m && m.length > 0) return m[0];

	m = DT.match(/\d\d\d\d-\d\d/g);
	if (m && m.length > 0) return m[0];

	m = DT.match(/\d\d\d\d/g);
	if (m && m.length > 0) return m[0];

	m = DT.match(/\d\d\d/g);
	if (m && m.length > 0) return "0" + m[0];

	return "";
}

function canonicalresult(RE) {

	RE = RE.trim().toUpperCase();

	if (RE.startsWith("B+R")) return "B+R";
	if (RE.startsWith("W+R")) return "W+R";
	if (RE.startsWith("B+T")) return "B+T";
	if (RE.startsWith("W+T")) return "W+T";
	if (RE.startsWith("B+F")) return "B+F";
	if (RE.startsWith("W+F")) return "W+F";
	if (RE.startsWith("VOID")) return "Void";
	if (RE.startsWith("JIGO")) return "Draw";
	if (RE.startsWith("DRAW")) return "Draw";

	if (RE.startsWith("B+") || RE.startsWith("W+")) {

		let slice_index = 2;

		while ("0123456789.".includes(RE[slice_index])) {
			slice_index++;
		}

		return RE.slice(0, slice_index);
	}

	return "?";
}

function sort_records(records) {
	records.sort((a, b) => {
		if (a.DT < b.DT) return -1;
		if (a.DT > b.DT) return 1;
		return 0;
	});
}

function deduplicate_records(records) {

	records.sort((a, b) => {
		if (a.dyer < b.dyer) return -1;
		if (a.dyer > b.dyer) return 1;
		return 0;
	});

	for (let n = records.length - 1; n > 0; n--) {
		if (records[n].dyer === records[n - 1].dyer && records[n].DT === records[n - 1].DT && records[n].movecount === records[n - 1].movecount) {
			records.splice(n, 1);						// In place
		}
	}
}

function span_string(record, element_id) {

	let result_direction = " ? ";
	if (record.RE.startsWith("B+")) result_direction = " > ";
	if (record.RE.startsWith("W+")) result_direction = " < ";

	let ha_string = (record.HA >= 2) ? `H${record.HA}` : "";

	let ev_ro_string = record.EV;
	if (record.RO) {
		ev_ro_string += ` (${record.RO})`;
	}

	return `<span id="${element_id}" class="game">` + 
		safe_html(
			pad_or_slice(record.DT, 12) +
			" " +
			pad_or_slice(record.RE, 7) +
			" " +
			pad_or_slice(record.movecount, 4, true) +
			"  " +
			pad_or_slice(ha_string, 3) + 
			" " +
			pad_or_slice(`${record.PB} ${record.BR}`, 26) + 
			" " +
			result_direction +
			" " +
			pad_or_slice(`${record.PW} ${record.WR}`, 26) +
			" " +
			pad_or_slice(ev_ro_string, 128)
		) +
		"</span>";
}



module.exports = {create_record_from_path, sort_records, deduplicate_records, span_string};
