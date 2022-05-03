"use strict";

// Very modified from Ogatak. Doesn't contain stuff we don't need, like ko handling, etc.

const fs = require("fs");
const load_sgf = require("./load_sgf");
const { xy_to_s, points_list } = require("./utils");

function new_board(width, height, state = null) {

	let ret = Object.create(board_prototype);

	ret.width = width;
	ret.height = height;
	ret.state = [];

	for (let x = 0; x < width; x++) {
		ret.state.push([]);
		for (let y = 0; y < height; y++) {
			if (state) {
				ret.state[x].push(state[x][y]);
			} else {
				ret.state[x].push("");
			}
		}
	}

	return ret;
}

let board_prototype = {

	copy: function() {
		return new_board(this.width, this.height, this.state);
	},

	in_bounds: function(s) {

		// Returns true / false if the point is on the board.
		// Note: any pass-ish things are not "in bounds".

		if (typeof s !== "string" || s.length !== 2) {
			return false;
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		return x >= 0 && x < this.width && y >= 0 && y < this.height;
	},

	state_at: function(s) {

		// Converts the point to [x][y] and returns the state there, "" or "b" or "w".

		if (!this.in_bounds(s)) {
			return "";
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		return this.state[x][y];
	},

	set_at: function(s, colour) {

		// Converts the point to [x][y] and sets the state there, colour should be "" or "b" or "w".
		// Adjusts the zobrist if we have one. So nothing else should ever set .state.

		if (!this.in_bounds(s)) {
			return;
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		this.state[x][y] = colour;
	},

	neighbours: function(s) {

		// Returns a list of points (in SGF format, e.g. "cc")
		// which neighbour the point given.

		let ret = [];

		if (!this.in_bounds(s)) {
			return ret;
		}

		let x = s.charCodeAt(0) - 97;
		let y = s.charCodeAt(1) - 97;

		if (x < this.width  - 1) ret.push(xy_to_s(x + 1, y));
		if (x > 0)               ret.push(xy_to_s(x - 1, y));
		if (y < this.height - 1) ret.push(xy_to_s(x, y + 1));
		if (y > 0)               ret.push(xy_to_s(x, y - 1));

		return ret;
	},

	destroy_group: function(s) {

		// Destroys the group and returns the number of stones removed.

		let group = this.group_at(s);
		let colour = this.state_at(s);

		for (let point of group) {
			this.set_at(point, "");
		}

		return group.length;
	},

	group_at: function(s) {

		if (!this.state_at(s)) {
			return [];
		}

		let touched = Object.create(null);

		this.group_at_recurse(s, touched);

		return Object.keys(touched);
	},

	group_at_recurse: function(s, touched) {

		touched[s] = true;

		let colour = this.state_at(s);

		for (let neighbour of this.neighbours(s)) {

			if (touched[neighbour]) {
				continue;
			}

			if (this.state_at(neighbour) === colour) {
				this.group_at_recurse(neighbour, touched);
			}
		}
	},

	has_liberties: function(s) {

		if (!this.state_at(s)) {
			return false;						// I guess?
		}

		let touched = Object.create(null);

		return this.has_liberties_recurse(s, touched);
	},

	has_liberties_recurse: function(s, touched) {

		touched[s] = true;

		let colour = this.state_at(s);

		for (let neighbour of this.neighbours(s)) {

			// Note that, by checking touched at the start, we allow legality checking by setting
			// the potentially suicidal / capturing stone as touched without actually playing it.

			if (touched[neighbour]) {
				continue;
			}

			let neighbour_colour = this.state_at(neighbour);

			if (!neighbour_colour) {
				return true;
			}

			if (neighbour_colour === colour) {
				if (this.has_liberties_recurse(neighbour, touched)) {
					return true;
				}
			}
		}

		return false;
	},

	play: function(s, colour) {

		// Play the move (or pass) given... contains no legality checks...

		if (colour !== "b" && colour !== "w") {
			throw new Error("play(): invalid colour");
		}

		if (!this.in_bounds(s)) {				// Treat as a pass.
			return;
		}

		this.set_at(s, colour);

		for (let neighbour of this.neighbours(s)) {

			let neighbour_colour = this.state_at(neighbour);

			if (neighbour_colour && neighbour_colour !== colour) {
				if (!this.has_liberties(neighbour)) {
					this.destroy_group(neighbour);
				}
			}
		}

		if (!this.has_liberties(s)) {
			this.destroy_group(s);
		}
	},

	add_empty: function(s) {
		let plist = points_list(s);
		for (let p of plist) {
			this.set_at(p, "");
		}
	},

	add_black: function(s) {
		let plist = points_list(s);
		for (let p of plist) {
			this.set_at(p, "b");
		}
	},

	add_white: function(s) {
		let plist = points_list(s);
		for (let p of plist) {
			this.set_at(p, "w");
		}
	},

};

// ------------------------------------------------------------------------------------------------

function board_from_node(nd) {

	let history = [];

	for (let node = nd; node; node = node.parent) {
		history.push(node);
	}

	history.reverse();

	let board = new_board(nd.width(), nd.height());

	for (let node of history) {

		for (let s of node.all_values("AE")) {
			board.add_empty(s);
		}

		for (let s of node.all_values("AB")) {
			board.add_black(s);
		}

		for (let s of node.all_values("AW")) {
			board.add_white(s);
		}

		for (let s of node.all_values("B")) {
			board.play(s, "b");
		}

		for (let s of node.all_values("W")) {
			board.play(s, "w");
		}
	}

	return board;
}



module.exports = {new_board, board_from_node};
