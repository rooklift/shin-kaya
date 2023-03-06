"use strict";

const fs = require("fs/promises");
const slashpath = require("./slashpath");
const { replace_all, ends_with_any } = require("./utils");

const skippable_ends = [".db", ".db-shm", ".db-wal", "journal"];

async function list_all_files(archivepath, relpath) {
	let ret = [];
	let read = await fs.readdir(slashpath.join(archivepath, relpath));
	for (let o of read) {
		let o_lower = o.toLowerCase();
		if (ends_with_any(o_lower, skippable_ends)) {
			continue;
		}
		let new_relpath = slashpath.join(relpath, o);
		if (o_lower.endsWith(".sgf")) {												// We think this is a file...
			ret.push(new_relpath);
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

function list_all_files_alternative(archivepath, relpath) {
	return fs.readdir(slashpath.join(archivepath, relpath)).then(read => {
		let files = [];
		let promises = [];
		for (let o of read) {
			let o_lower = o.toLowerCase();
			if (ends_with_any(o_lower, skippable_ends)) {
				continue;
			}
			let new_relpath = slashpath.join(relpath, o);
			if (o_lower.endsWith(".sgf")) {											// We think this is a file...
				files.push(new_relpath);
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
