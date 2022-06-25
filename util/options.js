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
		orderPreference: ["br"],
		useBuiltInWhenDisabled: true
	}

	if (userOptions.enableBrotli !== undefined) {
		sanitizedOptions.enableBrotli = !!userOptions.enableBrotli;
	}

	if (Array.isArray(userOptions.customCompressions)) {
		sanitizedOptions.customCompressions = userOptions.customCompressions;
	}

	if (Array.isArray(userOptions.orderPreference)) {
		sanitizedOptions.orderPreference = userOptions.orderPreference;
	}

	if (Array.isArray(userOptions.extensions)) {
		sanitizedOptions.extensions = userOptions.extensions;
	}

	if (userOptions.useBuiltInWhenDisabled !== undefined) {
		sanitizedOptions.useBuiltInWhenDisabled = !!userOptions.useBuiltInWhenDisabled;
	}

	return sanitizedOptions;
}

/**
 * Takes care of retrieving the index value, by also checking the deprecated `indexFromEmptyFile`
 * @param {expressStaticGzip.ExpressStaticGzipOptions} options 
 */
function getIndexValue(options) {
	if (options.indexFromEmptyFile === undefined && options.index !== undefined) {
		return options.index;
	} else if (options.index === undefined && options.indexFromEmptyFile !== undefined) {
		return options.indexFromEmptyFile;
	} else {
		return "index.html";
	}
}