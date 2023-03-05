"use strict";

const electron = require("electron");
electron.app.disableHardwareAcceleration();

const path = require("path");
const alert = require("./modules/alert_main");
const stringify = require("./modules/stringify");

const config_io = require("./modules/config_io");					// Creates global.config
config_io.load();													// Populates global.config

let menu = menu_build();
let menu_is_set = false;
let win;											// Need to keep global references to every window we make. (Is that still true?)

electron.app.whenReady().then(() => {
	startup();
});

function startup() {

	win = new electron.BrowserWindow({
		width: config.width,
		height: config.height,
		backgroundColor: "#000000",
		resizable: true,
		show: false,
		useContentSize: true,
		webPreferences: {
			backgroundThrottling: false,
			contextIsolation: false,
			nodeIntegration: true,
			spellcheck: false
		}
	});

	win.once("ready-to-show", () => {

		electron.nativeTheme.themeSource = "light";

		if (config.maxed) {
			win.maximize();
		}

		win.show();
		win.focus();
	});

	win.on("maximize", (event) => {
		win.webContents.send("set", {maxed: true});
	});

	win.on("unmaximize", (event) => {					// Note that these are not received when a maximized window is minimized.
		win.webContents.send("set", {maxed: false});	// I think they are only received when a maximized window becomes normal.
	});													// So our .maxed var tracks what we are trying to be, when shown at all.

	// Note: even though there is an event called "restore", if we call win.restore() for a minimized window
	// which wants to go back to being maximized, it generates a "maximize" event, not a "restore" event.

	win.once("close", (event) => {						// Note the once...
		event.preventDefault();							// We prevent the close one time only,
		win.webContents.send("call", "quit");			// to let renderer's "quit" method run once. It then sends "terminate" back.
	});

	electron.ipcMain.on("terminate", () => {
		win.close();
	});

	electron.app.on("window-all-closed", () => {
		electron.app.quit();
	});

	electron.ipcMain.on("alert", (event, msg) => {
		alert(win, msg);
	});

	electron.ipcMain.on("set_checks", (event, msg) => {
		set_checks(msg);
	});

	electron.ipcMain.on("set_check_false", (event, msg) => {
		set_one_check(false, msg);
	});

	electron.ipcMain.on("set_check_true", (event, msg) => {
		set_one_check(true, msg);
	});

	electron.ipcMain.on("verify_menupath", (event, msg) => {
		verify_menupath(msg);
	});

	electron.Menu.setApplicationMenu(menu);
	menu_is_set = true;

	// Actually load the page last, I guess, so the event handlers above are already set up.
	// Send some possibly useful info as a query.

	let query = {};
	query.user_data_path = electron.app.getPath("userData");

	win.loadFile(
		path.join(__dirname, "renderer.html"),
		{query: query}
	);
}

// --------------------------------------------------------------------------------------------------------------

function menu_build() {

	const template = [
		{
			label: "App",
			submenu: [
				{
					label: "About",
					click: () => {
						alert(win, `Shin Kaya (${electron.app.getVersion()}) in Electron (${process.versions.electron})`);
					}
				},
				{
					type: "separator",
				},
				{
					role: "toggledevtools"
				},
				{
					label: `Show ${config_io.filename}`,
					click: () => {
						electron.shell.showItemInFolder(config_io.filepath);
					}
				},
				{
					type: "separator",
				},
				{
					role: "resetZoom",
				},
				{
					role: "zoomIn",
				},
				{
					role: "zoomOut",
				},
				{
					type: "separator",
				},
				{
					label: "Quit",
					accelerator: "CommandOrControl+Q",
					role: "quit"
				},
			]
		},
		{
			label: "Database",
			submenu: [
				{
					label: "Fix (most) GoGoD names on import",
					type: "checkbox",
					checked: config.apply_gogod_fixes,
					click: () => {
						win.webContents.send("toggle", "apply_gogod_fixes");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Select archive folder...",
					click: () => {
						electron.dialog.showOpenDialog(win, {properties: ["openDirectory"]})
						.then(o => {
							if (Array.isArray(o.filePaths) && o.filePaths.length > 0) {
								win.webContents.send("set", {sgfdir: o.filePaths[0]});
							}
						});
					}
				},
				{
					label: "Count entries",
					click: () => {
						win.webContents.send("call", "display_row_count");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Update now",
					accelerator: "CommandOrControl+U",
					click: () => {
						win.webContents.send("call", "update_db");
					}
				},
				{
					label: "Stop update",
					click: () => {
						win.webContents.send("call", "stop_update");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Reset (destroy) database",
					click: () => {
						electron.dialog.showMessageBox(win, {
							message: "Really reset the database?",
							buttons: ["Reset and destroy", "Cancel"],
							cancelId: 1,								// Note: without this field, cancellation might (?) return 0 (poor design imo...)
							defaultId: 1,
							noLink: true,
							title: "Warning",
							type: "warning",
						}).then((o) => {
							if (o.response === 0) {
								win.webContents.send("call", "reset_db");
							}
						});
					}
				}
			]
		},
		{
			label: "View",
			submenu: [
				{
					label: "Deduplicate search results",
					type: "checkbox",
					checked: config.deduplicate,
					click: () => {
						win.webContents.send("toggle", "deduplicate");
					}
				},
				{
					type: "separator",
				},
				{
					label: "Preview depth (initial)",
					submenu: [
						{
							label: "0",
							type: "checkbox",
							checked: config.preview_depth === 0,
							click: () => {
								win.webContents.send("set", {preview_depth: 0});
							}
						},
						{
							label: "10",
							type: "checkbox",
							checked: config.preview_depth === 10,
							click: () => {
								win.webContents.send("set", {preview_depth: 10});
							}
						},
						{
							label: "20",
							type: "checkbox",
							checked: config.preview_depth === 20,
							click: () => {
								win.webContents.send("set", {preview_depth: 20});
							}
						},
						{
							label: "30",
							type: "checkbox",
							checked: config.preview_depth === 30,
							click: () => {
								win.webContents.send("set", {preview_depth: 30});
							}
						},
						{
							label: "40",
							type: "checkbox",
							checked: config.preview_depth === 40,
							click: () => {
								win.webContents.send("set", {preview_depth: 40});
							}
						},
						{
							label: "50",
							type: "checkbox",
							checked: config.preview_depth === 50,
							click: () => {
								win.webContents.send("set", {preview_depth: 50});
							}
						},
						{
							label: "60",
							type: "checkbox",
							checked: config.preview_depth === 60,
							click: () => {
								win.webContents.send("set", {preview_depth: 60});
							}
						},
						{
							label: "999",
							type: "checkbox",
							checked: config.preview_depth === 999,
							click: () => {
								win.webContents.send("set", {preview_depth: 999});
							}
						},
					]
				},
				{
					label: "Preview back",
					accelerator: "Left",
					click: () => {
						win.webContents.send("call", "prev_node");
					}
				},
				{
					label: "Preview forward",
					accelerator: "Right",
					click: () => {
						win.webContents.send("call", "next_node");
					}
				},
			]
		},
	];

	return electron.Menu.buildFromTemplate(template);
}

// --------------------------------------------------------------------------------------------------------------

function get_submenu_items(menupath) {

	// Not case-sensitive (or even type sensitive) in the menupath array, above.
	//
	// If the path is to a submenu, this returns a list of all items in the submenu.
	// If the path is to a specific menu item, it just returns that item.

	let ret = menu.items;

	for (let s of menupath) {

		s = stringify(s).toLowerCase();

		ret = ret.find(o => o.label.toLowerCase() === s);

		if (ret === undefined) {
			throw new Error(`get_submenu_items(): invalid path: ${menupath}`);
		}

		if (ret.submenu) {
			ret = ret.submenu.items;
		}
	}

	return ret;
}

function set_checks(menupath) {

	if (!menu_is_set) {
		return;
	}

	let items = get_submenu_items(menupath.slice(0, -1));
	let desired = stringify(menupath[menupath.length - 1]).toLowerCase();
	for (let n = 0; n < items.length; n++) {
		if (items[n].checked !== undefined) {
			items[n].checked = items[n].label.toLowerCase() === desired;
		}
	}
}

function set_one_check(desired_state, menupath) {

	if (!menu_is_set) {
		return;
	}

	let item = get_submenu_items(menupath);

	if (item.checked !== undefined) {
		item.checked = desired_state ? true : false;
	}
}

function verify_menupath(menupath) {

	if (!menu_is_set) {					// Not possible given how this is used, I think.
		return;
	}

	try {
		get_submenu_items(menupath);
	} catch (err) {
		alert(win, `Failed to verify menupath: ${stringify(menupath)}`);
	}
}
