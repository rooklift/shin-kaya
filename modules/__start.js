"use strict";

const {ipcRenderer} = require("electron");
const path = require("path");
const sql = require("better-sqlite3");
const stringify = require("./stringify");
const {get_href_query_val} = require("./utils");

const config_io = require("./config_io");		// Creates global.config
config_io.load();								// Populates global.config

global.alert = (msg) => {
	ipcRenderer.send("alert", stringify(msg));
};

global.hub = require("./hub");
global.db = sql(path.join(get_href_query_val("user_data_path"), "shinkaya.db"));

try {
    let st = db.prepare(`CREATE TABLE Games (
        path text,
        filename text,
        dyer text,
        SZ int,
        HA int,
        PB text,
        PW text,
        BR text,
        WR text,
        RE text,
        DT text,
        EV text)`
    );
	st.run();
} catch (err) {
	// It already exists
}

require("./__start_handlers");
require("./__start_spinners");

if (config_io.error()) {
	alert("Config file failed to load. It will not be written to. You should fix this.");
}

