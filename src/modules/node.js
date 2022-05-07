"use strict";

const stringify = require("./stringify");
const { replace_all } = require("./utils");

// ------------------------------------------------------------------------------------------------

function new_node(parent) {

	let node = Object.create(node_prototype);

	node.parent = parent;
	node.children = [];
	node.props = Object.create(null);			// key --> list of values (strings only)

	if (!parent) {								// This is a new root...

		node.__root = node;
		node.depth = 0;

	} else {

		parent.children.push(node);
		node.__root = parent.__root;			// Usually don't access this directly, call get_root() so that bugs will show up if it's not valid.
		node.depth = parent.depth + 1;

	}	

	return node;
}

// ------------------------------------------------------------------------------------------------

let node_prototype = {

	set: function(key, value) {
		this.props[key] = [stringify(value)];
	},

	add_value: function(key, value) {
		if (!this.has_key(key)) {
			this.props[key] = [stringify(value)];
		} else {
			this.props[key].push(stringify(value));
		}
	},

	delete_key: function(key) {
		delete this.props[key];
	},

	has_key: function(key) {
		return Array.isArray(this.props[key]);
	},

	get: function(key) {				// On the assumption there is at most 1 value for this key. Always returns a string.
		if (!this.has_key(key)) {
			return "";
		}
		return this.props[key][0];
	},

	all_values: function(key) {
		let ret = [];
		if (!this.has_key(key)) {
			return ret;
		}
		for (let value of this.props[key]) {
			ret.push(value);
		}
		return ret;
	},

	get_root: function() {
		if (!this.__root) {
			throw new Error("get_root(): root not available");
		}
		return this.__root;
	},

	width: function() {
		if (this.__board) {
			return this.__board.width;
		}
		let sz_prop = this.get_root().get("SZ");
		if (!sz_prop) {
			return 19;
		}
		let sz = parseInt(sz_prop, 10);
		if (!Number.isNaN(sz) && sz > 0) {
			return sz;
		}
		return 19;
	},

	height: function() {
		if (this.__board) {
			return this.__board.height;
		}
		let sz_prop = this.get_root().get("SZ");
		if (!sz_prop) {
			return 19;
		}
		let sz_slice;
		if (sz_prop.includes(":")) {
			sz_slice = sz_prop.slice(sz_prop.indexOf(":") + 1);
		} else {
			sz_slice = sz_prop;
		}
		let sz = parseInt(sz_slice, 10);
		if (!Number.isNaN(sz) && sz > 0) {
			return sz;
		}
		return 19;
	},

	dyer: function() {

		let node = this.get_root();
		let dyer = {20: "??", 40: "??", 60: "??", 31: "??", 51: "??", 71: "??"};
		let move_count = 0;

		while (true) {

			if (node.has_key("B") || node.has_key("W")) {
				move_count++;
			}

			if ([20, 40, 60, 31, 51, 71].includes(move_count)) {
				let s = node.get("B") || node.get("W");
				if (s.length === 2) {
					dyer[move_count] = s;
				}
			}

			if (node.children.length === 0 || move_count >= 71) {
				break;
			}

			node = node.children[0];
		}

		return dyer[20] + dyer[40] + dyer[60] + dyer[31] + dyer[51] + dyer[71];
	},

	destroy_tree: function() {
		destroy_tree_recursive(this.get_root());
	},
	
};

// ------------------------------------------------------------------------------------------------

function destroy_tree_recursive(node) {

	while (true) {

		let children = node.children;

		node.parent = null;
		node.children = [];
		node.props = Object.create(null);
		node.destroyed = true;
		node.__root = null;

		if (children.length > 1) {
			for (let child of children) {
				destroy_tree_recursive(child);
			}
			break;
		} else if (children.length === 1) {
			node = children[0];
			continue;
		} else {
			break;
		}
	}
}



module.exports = new_node;
