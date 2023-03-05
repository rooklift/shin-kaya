"use strict";

const fs = require("fs/promises");
const slashpath = require("./slashpath");
const { replace_all } = require("./utils");

function list_all_files(archivepath, relpath) {

	return fs.readdir(slashpath.join(archivepath, relpath)).then(read => {

		let files = [];
		let promises = [];

		for (let o of read) {

			let new_relpath = slashpath.join(relpath, o);

			if (o.toLowerCase().endsWith(".sgf")) {								// We think this is a file...
				files.push(new_relpath);
			} else if (o.toLowerCase().endsWith(".db")) {
				// skip
			} else if (o.toLowerCase().endsWith("journal")) {
				// skip
			} else {															// We think this is a directory...
				let np = list_all_files(archivepath, new_relpath);
				promises.push(np);
			}
		}

		// So we have files and promises... return a promise that will construct the final result...

		return Promise.all(promises).then(promised_results => {
			let result = Array.from(files);
			for (let arr of promised_results) {
				result = result.concat(arr);
			}
			return result;
		});
	});
}

/*
// This is equivalent. I gotta say the async/await version was easier to write...

async function list_all_files(archivepath, relpath) {

	let ret = [];

	let read = await fs.readdir(slashpath.join(archivepath, relpath));

	for (let o of read) {

		let new_relpath = slashpath.join(relpath, o);

		if (o.toLowerCase().endsWith(".sgf")) {								// We think this is a file...
			ret.push(new_relpath);
		} else if (o.toLowerCase().endsWith(".db")) {
			// skip
		} else if (o.toLowerCase().endsWith("journal")) {
			// skip
		} else {															// We think this is a directory...
			let recurse = await list_all_files(archivepath, new_relpath);
			ret = ret.concat(recurse);
		}
	}

	return ret;
}
*/

module.exports = {list_all_files};


