"use strict";

// The node object contains the state of an SGF node, i.e. a node in a game tree.
// SGF properties are stored as a map of key --> list of values, with everything being stored as a string.
//
// Note that the canonical source of WHICH COLOUR THE NEXT MOVE SHOULD BE is always get_board().active, no exceptions.
// If there's any discrepancy between get_board().active and what you'd expect from node props, get_board().active prevails.
// Nothing in the codebase should depend on get_board().active matching what's in the node. Assume it could be either colour.

const path = require("path");

const stringify = require("./stringify");
const {replace_all} = require("./utils");

let next_node_id = 1;

// ------------------------------------------------------------------------------------------------

function new_node(parent) {

	let node = Object.create(node_prototype);
	node.change_id();

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

	change_id: function() {
		if (!this.id) {
			this.id = `node_${next_node_id++}`;
		} else {
			let old_id = this.id;
			this.id = `node_${next_node_id++}`;
			if (this.parent && this.parent.__blessed_child_id === old_id) {
				this.parent.__blessed_child_id = this.id;
			}
		}
	},

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

	has_key: function(key) {
		return Array.isArray(this.props[key]);
	},

	get: function(key) {				// On the assumption there is at most 1 value for this key. Always returns a string.
		if (!this.has_key(key)) {
			return "";
		}
		return this.props[key][0];
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
