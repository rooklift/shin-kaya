"use strict";

const fs = require("fs");
const path = require("path");
const {replace_all} = require("./utils");

function list_all_files(...args) {
	let dir_list = args.flat(Infinity);
	let ret = [];
	for (let d of dir_list) {
		let read;
		try {
			read = fs.readdirSync(d);
		} catch (err) {
			console.log(err.toString());
			continue;
		}
		for (let o of read) {
			let fullpath = path.join(d, o);
			if (o.toLowerCase().endsWith(".sgf")) {								// We think this is a file...
				if (global.process && global.process.platform === "win32") {
					ret.push(replace_all(fullpath, "\\", "/"));
				} else {
					ret.push(fullpath);
				}
			} else if (o.toLowerCase().endsWith(".db")) {
				// pass
			} else if (o.toLowerCase().endsWith("journal")) {
				// pass
			} else {															// We think this is a directory...
				ret = ret.concat(list_all_files(fullpath));
			}
		}
	}
	return ret;
}



module.exports = {list_all_files}
