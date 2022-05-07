"use strict";

const fs = require("fs");
const slashpath = require("./slashpath");
const { replace_all } = require("./utils");

function list_all_files(archivepath, relpath) {								// Returns a list of paths relative to the archive path.
	let ret = [];
	let read;
	try {
		read = fs.readdirSync(slashpath.join(archivepath, relpath));
	} catch (err) {
		console.log(err.toString());
		return ret;
	}
	for (let o of read) {
		let file_relpath = slashpath.join(relpath, o);
		if (o.toLowerCase().endsWith(".sgf")) {								// We think this is a file...
			ret.push(file_relpath);
		} else if (o.toLowerCase().endsWith(".db")) {
			console.log(`Skipping ${file_relpath}`);
		} else if (o.toLowerCase().endsWith("journal")) {
			console.log(`Skipping ${file_relpath}`);
		} else {															// We think this is a directory...
			ret = ret.concat(list_all_files(archivepath, file_relpath));
		}
	}
	return ret;
}



module.exports = {list_all_files};
