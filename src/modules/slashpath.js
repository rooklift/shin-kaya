"use strict";

const path = require("path");
const { replace_all } = require("./utils");

// I want to consistently return "/" separated paths regardless of platform.
// This module has wrappers for several "path" methods to do this...

exports.basename = path.basename;

exports.dirname = (s) => {
	s = path.dirname(s);
	if (global.process && global.process.platform === "win32") {
		s = replace_all(s, "\\", "/");
	}
	return s;
};

exports.join = (...args) => {
	let s = path.join(...args);
	if (global.process && global.process.platform === "win32") {
		s = replace_all(s, "\\", "/");
	}
	return s;
};
