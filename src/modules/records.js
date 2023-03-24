"use strict";

const fs = require("fs");
const slashpath = require("./slashpath");
const load_sgf = require("./load_sgf");
const { replace_all, safe_html, pad_or_slice } = require("./utils");

const gogod_name_fixes = require("./gogod_name_fixes");

function create_record(root, relpath) {					// root is an SGF node

	let ret = {
		relpath:   relpath,
		dyer:      root.dyer(),
		movecount: move_count(root),
		SZ:        19,									// Maybe changed below.
		HA:        0,									// Maybe changed below.
		PB:        root.get("PB"),
		PW:        root.get("PW"),
		BR:        root.get("BR"),
		WR:        root.get("WR"),
		RE:        canonicalresult(root.get("RE")),
		DT:        canonicaldate(root.get("DT")),
		EV:        root.get("EV"),
		RO:        root.get("RO"),
	};

	for (let key of ["SZ", "HA"]) {
		let i = parseInt(root.get(key), 10);
		if (!Number.isNaN(i)) {
			ret[key] = i;
		}
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

function create_record_from_path(archivepath, relpath) {				// Can throw

	let fullpath = slashpath.join(archivepath, relpath);

	if (!fs.existsSync(fullpath)) {
		throw new Error("No such file");
	}

	let buf = fs.readFileSync(fullpath);								// Can throw (theoretically and maybe actually)
	let root = load_sgf(buf);											// Can throw

	return create_record(root, relpath);
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
	if (RE === "0") return "Draw";

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
		if (a.EV < b.EV) return -1;
		if (a.EV > b.EV) return 1;
		if (a.RO < b.RO) return -1;
		if (a.RO > b.RO) return 1;
		if (a.PB < b.PB) return -1;
		if (a.PB > b.PB) return 1;
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

	return `<span id="${element_id}" class="game">` + 				// We want to guarantee the whitespace exists hence all the " "
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
