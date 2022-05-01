"use strict";

const {ipcRenderer} = require("electron");
const stringify = require("./stringify");
const {get_href_query_val} = require("./utils");

const config_io = require("./config_io");		// Creates global.config
config_io.load();								// Populates global.config

global.alert = (msg) => {
	ipcRenderer.send("alert", stringify(msg));
};

global.hub = require("./hub");

require("./__start_handlers");
require("./__start_spinners");

if (config_io.error()) {
	alert("Config file failed to load. It will not be written to. You should fix this.");
}

