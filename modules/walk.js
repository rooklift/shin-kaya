"use strict";

const fs = require("fs");
const path = require("path");
const {replace_all} = require("./utils");

function list_all_files(...args) {
	let dir_list = args.flat(Infinity);
	let ret = [];
	for (let d of dir_list) {
		let read = fs.readdirSync(d);
		for (let o of read) {
			let fullpath = path.join(d, o);
			if (o.toLowerCase().endsWith(".sgf")) {										// We think this is a file...
				if (global.process && global.process.platform === "win32") {
					ret.push(replace_all(fullpath, "\\", "/"));
				} else {
					ret.push(fullpath);
				}
			} else {																	// We think this is a directory...
				try {
					ret = ret.concat(list_all_files(fullpath));
				} catch (err) {
					// pass
				}
			}
		}
	}
	return ret;
}



module.exports = {list_all_files}
