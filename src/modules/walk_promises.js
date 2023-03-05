"use strict";

const fs = require("fs/promises");
const slashpath = require("./slashpath");
const { replace_all } = require("./utils");

function list_all_files(archivepath, relpath) {

	// An async / await version would be slightly easier to write, but oh well.

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
