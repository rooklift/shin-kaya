"use strict";

const fs = require("fs");
const path = require("path");

function list_all_files(...args) {
	let dir_list = args.flat(Infinity);
	let ret = [];
	for (let d of dir_list) {
		let read = fs.readdirSync(d);
		for (let o of read) {
			let fullpath = path.join(d, o);
			if (o.toLowerCase().endsWith(".sgf")) {
				ret.push(fullpath);
			} else {
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
