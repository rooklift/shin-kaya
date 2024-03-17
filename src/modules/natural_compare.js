"use strict";

function is_digit(c) {					// c should be a single character.
	return c >= "0" && c <= "9";
}

function extract_number(s, i) {			// Returns a string.
	let acc = [];
	while (is_digit(s[i])) {
		acc.push(s[i]);
		i++;
	}
	return acc.join("");
}

function natural_compare(a, b) {		// Both should be strings.
	if (a === b) {
		return 0;
	}
	let i = 0;
	let j = 0;
	while (true) {
		let ca = a[i]
		let cb = b[j]
		if (ca === undefined && cb === undefined) {
			return 0;
		} else if (ca === undefined) {
			return -1;
		} else if (cb === undefined) {
			return 1;
		}
		if (is_digit(ca) && is_digit(cb)) {
			let na = extract_number(a, i);
			let nb = extract_number(b, j);
			if (na !== nb) {
				return parseInt(na, 10) - parseInt(nb, 10);
			}
			i += na.length;
			j += nb.length;
		} else {
			if (ca < cb) {
				return -1;
			}
			if (ca > cb) {
				return 1;
			}
			i++;
			j++;
		}
	}
}

module.exports = natural_compare;
