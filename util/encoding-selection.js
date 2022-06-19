// see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding

// Indicates the identity function (i.e. no compression, nor modification)
const NO_COMPRESSION = "identity";

/**
 *
 * @param {string} acceptEncoding Content of the accept-encoding header
 * @param {{encodingName: string, fileExtension: string}[]} availableCompressions
 * @param {string[]} preference
 */
function findEncoding(acceptEncoding, availableCompressions, preference) {
	if (acceptEncoding) {
		let sortedEncodingList = parseEncoding(acceptEncoding);
		sortedEncodingList = sortByPreference(
			sortedEncodingList,
			preference
		);

		return findMatchingCompression(
			sortedEncodingList,
			availableCompressions
		);
	}
	return findUncompressed(availableCompressions);
}

function findMatchingCompression(sortedEncodingList, availableCompressions) {
	for (const encoding of sortedEncodingList) {
		if (encoding == NO_COMPRESSION) {
			return findUncompressed(availableCompressions);
		}
		for (let availableCompression of availableCompressions) {
			if (encoding == "*" || encoding == availableCompression.encodingName) {
				return availableCompression;
			}
		}
	}
	return findUncompressed(availableCompressions);
}

/**
 *
 * @param {string[]} sortedEncodingList
 * @param {string[]} preferences
 */
function sortByPreference(sortedEncodingList, preferences) {
	if ((! preferences) || preferences.length == 0) {
		return sortedEncodingList;
	}

	for (let i = preferences.length - 1; i >= 0; i--) {
		let pref = preferences[i];
		let existingPrefIndex = sortedEncodingList.indexOf(pref);

		if (existingPrefIndex != -1) {
			sortedEncodingList.splice(existingPrefIndex, 1);
			sortedEncodingList.splice(0, 0, pref);
		}
	}

	return sortedEncodingList;
}

/**
 *
 * @param {string} acceptedEncodings
 */
function parseEncoding(acceptedEncodings) {
	acceptedEncodings = acceptedEncodings
		.split(",")
		.map((encoding) => parseQuality(encoding))
		.sort((encodingA, encodingB) => encodingB.q - encodingA.q)
		.filter((encoding) => encoding.q != 0)
		.map((encoding) => encoding.name);

	acceptedEncodings.push("none");
	return acceptedEncodings;
}

/**
 * Parses the quality value of an entry. Empty value will be set to 1.
 * @param {string} encoding
 * @returns {{name: string, q: number}[]}
 */
function parseQuality(encoding) {
	let eSplit = encoding.split(";");
	try {
		if (eSplit.length > 1) {
			const num = eSplit[1].trim().match(/q=(.*)/)[1];
			return {
				name: eSplit[0].trim(),
				q: parseFloat(num)
			};
		}
	} catch {}

	return {
		name: eSplit[0].trim(),
		q: 1
	};
}

function findUncompressed(availableCompressions) {
	return availableCompressions.find(compression => compression.encodingName == "none");
}

module.exports = {
	findEncoding: findEncoding
};
