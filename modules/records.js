"use strict";

const fs = require("fs");
const path = require("path");

const load_sgf = require("./load_sgf");
const {replace_all} = require("./utils");

function create_record(root, filepath) {

	let ret = {};

	// Strings...

	for (let key of ["BR", "WR", "EV", "PB", "PW", "DT", "RE"]) {
		ret[key] = root.get(key);										// get() returns "" if absent, which is what we want.
	}

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

	ret.dyer = "";														// FIXME / TODO
	ret.path = path.dirname(filepath);									// path does not include filename
	ret.filename = path.basename(filepath);

	// For consistency, lets always use / as a path separator...

	if (global.process && global.process.platform === "win32") {
		ret.path = replace_all(ret.path, "\\", "/");
	}

	return ret;
}

function create_record_from_path(filepath) {							// Can throw

	if (!fs.existsSync(filepath)) {
		throw new Error("No such file");
	}

	let buf = fs.readFileSync(filepath);								// Can throw (theoretically)
	let root = load_sgf(buf);											// Can throw

	return create_record(root, filepath);
}

function canonical_date(record) {

	if (!record.DT) return "";

	let m;

	m = record.DT.match(/\d\d\d\d-\d\d-\d\d/g);
	if (m.length > 0) return m[0];

	m = record.DT.match(/\d\d\d\d-\d\d/g);
	if (m.length > 0) return m[0];

	m = record.DT.match(/\d\d\d\d/g);
	if (m.length > 0) return m[0];

	m = record.DT.match(/\d\d\d/g);
	if (m.length > 0) return "0" + m[0];

	return "";
}

function sort_records(records) {
	records.sort((a, b) => {
		let can_date_a = canonical_date(a);
		let can_date_b = canonical_date(b);
		if (can_date_a < can_date_b) return -1;
		if (can_date_a > can_date_b) return 1;
		return 0;
	});
}



module.exports = {create_record_from_path, sort_records};
