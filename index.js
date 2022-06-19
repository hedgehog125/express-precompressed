/*
TODO

Handle no compression request from client
Dot files and other options
*/

const fs = require("fs/promises");
const path = require("path");
const mime = require("mime-types");
const { resolve } = require("path");

__dirname = path.join(__dirname, "../../"); // Go to the root of the program

let sanitizeOptions = require("./util/options").sanitizeOptions;
let findEncoding = require("./util/encoding-selection").findEncoding;

module.exports = expressStaticGzipMiddleware;

/**
 * Generates a middleware function to serve pre-compressed files. It just uses the express sendFile method.
 * The pre-compressed files need to be placed next to the original files, in the provided `root` directory.
 * @param { string } root: directory to staticly serve files from
 * @param { string } uncompressedRoot: a fallback folder containing uncompressed files for clients that don't support encoding
 * @param { expressStaticGzip.ExpressStaticGzipOptions } options: options to change module behaviour
 * @returns express middleware function
 */
async function expressStaticGzipMiddleware(root, uncompressedRoot, options) {
	root = removeEndingSlash(root);
	uncompressedRoot = removeEndingSlash(uncompressedRoot);
	let opts = sanitizeOptions(options);

	let compressions = {};
	let files = {};


	registerCompressions();
	await indexRoot();

	return expressStaticGzip;

	function expressStaticGzip(req, res, next) {
		let requestPath = req.path;
		try {
			requestPath = decodeURIComponent(requestPath);
		} catch (error) {
			next();
			return;
		}

		if (requestPath == "" || requestPath == "/") {
			requestPath = opts.index;
		}
		else if (requestPath[0] == "/") {
			requestPath = requestPath.slice(1);
		}

		let compressedFileInfo = files[requestPath];
		if (compressedFileInfo) {
			sendCompressed(req, res, compressedFileInfo);
		}

		next();
	}

	function registerCompressions() {
		if (opts.customCompressions && opts.customCompressions.length != 0) {
			for (let customCompression of opts.customCompressions) {
				registerCompression(
					customCompression.encodingName,
					customCompression.fileExtension
				);
			}
		}

		if (opts.enableBrotli) {
			registerCompression("br", "br");
		}

		registerCompression("gzip", "gz");
	}

	/**
	 * Registers a new compression to the module.
	 * @param {string} encodingName
	 * @param {string} fileExtension
	 */
	 function registerCompression(encodingName, fileExtension) {
		if (compressions[fileExtension] == null) {
			compressions[fileExtension] = new Compression(encodingName, fileExtension);
		}
	}

	function sendCompressed(req, res, compressedFileInfo) {
		let clientsAcceptedEncodings = req.headers["accept-encoding"];
		let compression = findEncoding(
			clientsAcceptedEncodings,
			compressedFileInfo.compressions,
			opts.orderPreference
		);

		let type = mime.lookup(compressedFileInfo.filePath) || "application/octet-stream";
		let charset = mime.charset(type);

		res.sendFile(compressedFileInfo.filePath + compression.fileExtension, {
			headers: {
				"Content-Type": type + (charset? "; charset=" + charset : ""),
				"Content-Encoding": compression.encodingName,
				"Vary": "Accept-Encoding" // The Vary Header is required for caching proxies to work properly
			}
		});
	}

	async function indexRoot() {
		let fullFolderPath = path.join(__dirname, root);
		try {
			await fs.stat(fullFolderPath);
		}
		catch {
			throw new Error(`Root path does not exist. Full path: ${fullFolderPath}`);
		}

		await indexFolder(root);
	}

	async function indexFolder(directoryPath) {
		let fullFolderPath = path.join(__dirname, directoryPath);

		// Read the files in parrelel for efficiency
		let finished;
		let finishedPromise = new Promise(resolve => {
			finished = resolve; // Let the file promises resolve this promise
		});
		let fileTasks = [];
		
		let filesInDirectory = await fs.readdir(fullFolderPath);
		let remaining = filesInDirectory.length;
		for (let file of filesInDirectory) {
			let filePath = directoryPath + "/" + file;
			fileTasks.push(fs.stat(filePath).then(async fileInfo => {
				if (fileInfo.isDirectory()) {
					await indexFolder(filePath);
				} else {
					addFileCompressions(file, filePath);
				}

				remaining--;
				if (remaining == 0) finished();
			}));
		}

		await finishedPromise;
	}

	/**
	 * Takes a filename and checks if there is any compression type matching the file extension.
	 * Adds all matching compressions to the file.
	 * @param {string} fileName
	 * @param {string} fillFilePath
	 */
	function addFileCompressions(fileName, fullFilePath) {
		// Remove the compression file extension in fullFilePath
		fullFilePath = fullFilePath.split(".");
		let compressionExtension = fullFilePath.pop();
		fullFilePath = fullFilePath.join(".");

		let noExtension = fullFilePath.split(".");
		if (noExtension.length != 1) noExtension.pop();
		noExtension = noExtension.join(".");

		let compression = compressions[compressionExtension];
		if (compression) {
			addCompressionToFile(fullFilePath, compression, "");

			for (let ext of opts.extensions) {
				if (fileName.endsWith(`.${ext}${compression.fileExtension}`)) {
					addCompressionToFile(noExtension, compression, `.${ext}`);
					break;
				}
			}
		}
	}

	/**
	 * Adds the compression to the file's list of available compressions
	 * @param {string} filePath
	 * @param {Compression} compression
	 * @param {string} missingExtension
	 */
	function addCompressionToFile(filePath, compression, missingExtension) {
		let urlFilePath = filePath.replace(root + "/", "");
		let existingFile = files[urlFilePath];

		if (existingFile) {
			existingFile.compressions.push(compression);
		} else {
			files[urlFilePath] = {
				compressions: [compression],
				filePath: path.join(__dirname, `${filePath}${missingExtension}`)
			};
		}
	}

	/**
	 * @param {string} encodingName
	 * @param {string} fileExtension
	 * @returns {{encodingName:string, fileExtension:string}}
	 */
	function Compression(encodingName, fileExtension) {
		this.encodingName = encodingName;
		this.fileExtension = "." + fileExtension;
	}

	function removeEndingSlash(path) {
		if (path.at(-1) == "/") return path.slice(0, path.length - 1);

		return path;
	}
}
