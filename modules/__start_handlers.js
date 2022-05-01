"use strict";

const {ipcRenderer, shell} = require("electron");
const {board_from_path} = require("./board");
const thumbnail = require("./thumbnail");
const {event_path_string} = require("./utils");

// Uncaught exceptions should trigger an alert (once only)...

window.addEventListener("error", (event) => {
	alert("An uncaught exception happened in the renderer process. See the dev console for details. The app might now be in a bad state.");
}, {once: true});

// ------------------------------------------------------------------------------------------------

document.getElementById("searchbutton").addEventListener("click", () => {
	hub.search();
});

document.getElementById("gamesbox").addEventListener("dblclick", (event) => {
	let suffix = event_path_string(event, "gamesbox_entry_");
	if (suffix) {
		let element_id = "gamesbox_entry_" + suffix;
		let fullpath = hub.lookups[element_id];
		shell.openPath(fullpath);
	}
});

document.getElementById("gamesbox").addEventListener("click", (event) => {
	let suffix = event_path_string(event, "gamesbox_entry_");
	if (suffix) {
		let element_id = "gamesbox_entry_" + suffix;
		let fullpath = hub.lookups[element_id];
		let board = board_from_path(fullpath);
		let o = thumbnail(board);
		document.getElementById("preview").src = o.data;
	}
});

for (let element of document.querySelectorAll("input")) {
	element.addEventListener("keydown", (event) => {
		if (event.code === "Enter" || event.code === "NumpadEnter") {
			hub.search();
		}
	});
}

// ------------------------------------------------------------------------------------------------

ipcRenderer.on("set", (event, msg) => {
	for (let [key, value] of Object.entries(msg)) {
		hub.set(key, value);
	}
});

ipcRenderer.on("toggle", (event, msg) => {
	hub.set(msg, !config[msg]);
});

ipcRenderer.on("call", (event, msg) => {
	let fn;
	if (typeof msg === "string") {																		// msg is function name
		fn = hub[msg].bind(hub);
	} else if (typeof msg === "object" && typeof msg.fn === "string" && Array.isArray(msg.args)) {		// msg is object with fn and args
		fn = hub[msg.fn].bind(hub, ...msg.args);
	} else {
		console.log("Bad call, msg was...");
		console.log(msg);
	}
	fn();
});
