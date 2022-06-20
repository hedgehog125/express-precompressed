module.exports = {
	sanitizeOptions: sanitizeOptions
};

/**
 * Prepares the options object for later use. Strips away any options used for serve-static.
 * Removes problematic options from the input options object.
 * @param {expressStaticGzip.ExpressStaticGzipOptions} userOptions 
 * @returns {expressStaticGzip.ExpressStaticGzipOptions}
 */
function sanitizeOptions(userOptions) {
	userOptions = userOptions?? {};

	/**
	 * @type {expressStaticGzip.ExpressStaticGzipOptions}
	 */
	let sanitizedOptions = {
		index: getIndexValue(userOptions),
		disableCompression: userOptions.disableCompression?? false,
		orderPreference: ["br"]
	}

	if (typeof (userOptions.enableBrotli) !== "undefined") {
		sanitizedOptions.enableBrotli = !!userOptions.enableBrotli;
	}

	if (typeof (userOptions.customCompressions) === "object") {
		sanitizedOptions.customCompressions = userOptions.customCompressions;
	}

	if (typeof (userOptions.orderPreference) === "object") {
		sanitizedOptions.orderPreference = userOptions.orderPreference;
	}

	if (Array.isArray(userOptions.extensions)) {
		sanitizedOptions.extensions = userOptions.extensions;
	}

	return sanitizedOptions;
}

/**
 * Takes care of retrieving the index value, by also checking the deprecated `indexFromEmptyFile`
 * @param {expressStaticGzip.ExpressStaticGzipOptions} options 
 */
function getIndexValue(options) {
	if (typeof (options.indexFromEmptyFile) == "undefined" && typeof (options.index) != "undefined") {
		return options.index;
	} else if (typeof (options.index) == "undefined" && typeof (options.indexFromEmptyFile) != "undefined") {
		return options.indexFromEmptyFile;
	} else {
		return "index.html";
	}
}