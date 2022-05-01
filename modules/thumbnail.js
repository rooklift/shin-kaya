"use strict";

module.exports = function(board, square_size = 11) {

	if (!board) {
		throw new Error("thumbnail.js: board must be valid");
	}

	let c = document.createElement("canvas");

	c.width = square_size * Math.max(19, board.width);
	c.height = square_size * Math.max(19, board.height);

	let visible_x_width = square_size * board.width;
	let visible_y_height = square_size * board.height;

	let x_offset = (c.width / 2) - (visible_x_width / 2);
	let y_offset = (c.height / 2) - (visible_y_height / 2);

	let ctx = c.getContext("2d");

	ctx.fillStyle = "#d0ad75ff";
	ctx.beginPath();
	ctx.rect(x_offset, y_offset, visible_x_width, visible_y_height);
	ctx.fill();

	ctx.strokeStyle = "#775511ff";

	for (let x = 0; x < board.width; x++) {
		let x1 = (x * square_size) + (square_size / 2);
		let y1 = (square_size / 2);
		let y2 = (board.height * square_size) - (square_size / 2);
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x1, y2);
		ctx.stroke();
	}

	for (let y = 0; y < board.height; y++) {
		let y1 = (y * square_size) + (square_size / 2);
		let x1 = (square_size / 2);
		let x2 = (board.width * square_size) - (square_size / 2);
		ctx.beginPath();
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y1);
		ctx.stroke();
	}

	for (let x = 0; x < board.width; x++) {
		for (let y = 0; y < board.height; y++) {
			if (board.state[x][y]) {

				let gx = x * square_size + (square_size / 2) + x_offset;
				let gy = y * square_size + (square_size / 2) + y_offset;

				ctx.fillStyle = board.state[x][y] === "b" ? "#000000ff" : "#ffffffff";
				ctx.lineWidth = 0;

				ctx.beginPath();
				ctx.arc(gx, gy, (square_size / 2 - square_size * 0.05), 0, 2 * Math.PI);
				ctx.fill();
			}
		}
	}

	return {
		data: c.toDataURL("image/png"),
		width: c.width,
		height: c.height
	};
};
