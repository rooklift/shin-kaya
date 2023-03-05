"use strict";

const fs = require("fs/promises");
const slashpath = require("./slashpath");
const { replace_all } = require("./utils");

async function list_all_files(archivepath, relpath) {
	let ret = [];
	let read = await fs.readdir(slashpath.join(archivepath, relpath));
	for (let o of read) {
		let new_relpath = slashpath.join(relpath, o);
		if (o.toLowerCase().endsWith(".sgf")) {										// We think this is a file...
			ret.push(new_relpath);
		} else if (o.toLowerCase().endsWith(".db")) {
			// skip
		} else if (o.toLowerCase().endsWith("journal")) {
			// skip
		} else {																	// We think this is a directory... but maybe not.
			try {
				let recurse = await list_all_files(archivepath, new_relpath);
				ret = ret.concat(recurse);
			} catch (err) {
				// skip
			}
		}
	}
	return ret;
}

// Pure promise-based version without using async / await keywords. However, the await version
// might be better because it doesn't try to concurrently read multiple folders at once?

function list_all_files_alterative(archivepath, relpath) {

	return fs.readdir(slashpath.join(archivepath, relpath)).then(read => {

		let files = [];
		let promises = [];

		for (let o of read) {

			let new_relpath = slashpath.join(relpath, o);

			if (o.toLowerCase().endsWith(".sgf")) {									// We think this is a file...
				files.push(new_relpath);
			} else if (o.toLowerCase().endsWith(".db")) {
				// skip
			} else if (o.toLowerCase().endsWith("journal")) {
				// skip
			} else {																// We think this is a directory... but maybe not.
				let np = list_all_files(archivepath, new_relpath).catch(err => []);
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


module.exports = {list_all_files};
