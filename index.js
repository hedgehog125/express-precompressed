/*
TODO

Handle no compression request from client
Dot files and other options
*/

const fs = require("fs/promises");
const path = require("path");
const mime = require("mime-types");

__dirname = path.join(__dirname, "../../"); // Go to the root of the program

let sanitizeOptions = require("./util/options").sanitizeOptions;
let findEncoding = require("./util/encoding-selection").findEncoding;

module.exports = expressStaticGzipMiddleware;

/**
 * Generates a middleware function to serve pre-compressed files. It just uses the express sendFile method.
 * The pre-compressed files need to be placed next to the original files, in the provided `root` directory.
 * @param { string } root: directory to staticly serve files from
 * @param { string } uncompressedRoot: a fallback folder containing uncompressed files for clients that don't support encoding, or for when you've disabled compression. It's assumed that this contains the same files (with the original extensions) as the main root folder, so it uses the same index as root (unless compression is disabled in the options, then this folder will be indexed instead which can be useful for testing). Defaults to the same as root
 * @param { expressStaticGzip.ExpressStaticGzipOptions } options: options to change module behaviour
 * @returns express middleware function
 */
function expressStaticGzipMiddleware(root, uncompressedRoot, options) {
	root = removeEndingSlash(root);
	uncompressedRoot = uncompressedRoot == null? root : removeEndingSlash(uncompressedRoot);
	
	let opts = sanitizeOptions(options);
	if (opts.disableCompression) root = uncompressedRoot;

	let compressions = {};
	let files = {};
	let startupTasks = {
		index: null
	};

	registerCompressions();
	asyncStartUp();

	return handleFile;

	async function handleFile(req, res, next) {
		let requestPath = req.path;
		try {
			requestPath = decodeURIComponent(requestPath);
		} catch (error) {
			next();
			return;
		}

		// Make sure the indexing is done first
		await startupTasks.index;

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

	async function asyncStartUp() {
		startupTasks.index = indexRoot();

		await startupTasks.index;
		console.log(files);
	}

	function registerCompressions() {
		registerCompression("none", "");
		registerCompression("gzip", "gz");

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
	}

	/**
	 * Registers a new compression to the module.
	 * @param {string} encodingName
	 * @param {string} fileExtension
	 */
	 function registerCompression(encodingName, fileExtension) {
		let key = encodingName == "none"? "none" : fileExtension;
		if (compressions[key] == null) {
			compressions[key] = new Compression(encodingName, fileExtension);
		}
	}

	function sendCompressed(req, res, compressedFileInfo) {
		let clientsAcceptedEncodings = req.headers["accept-encoding"];
		let compression;
		if (opts.disableCompression) {
			compression = compressions.none;
		}
		else {
			compression = findEncoding(
				clientsAcceptedEncodings,
				compressedFileInfo.compressions,
				opts.orderPreference
			);
		}

		let type = mime.lookup(compressedFileInfo.filePath) || "application/octet-stream";
		let charset = mime.charset(type);

		let fileRoot = compression.encodingName == "none"? uncompressedRoot : root;
		let filePath = fileRoot + compressedFileInfo.incompletePath + compression.fileExtension;
		res.sendFile(filePath, {
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

		await indexFolder("");
	}

	async function indexFolder(directoryPath) {
		let pathInRoot = path.join(root, directoryPath);
		let fullFolderPath = path.join(__dirname, pathInRoot);

		// Read the files in parrelel for efficiency
		let finished;
		let finishedPromise = new Promise(resolve => {
			finished = resolve; // Let the file promises resolve this promise
		});
		let fileTasks = [];
		
		let filesInDirectory = await fs.readdir(fullFolderPath);
		let remaining = filesInDirectory.length;
		for (let file of filesInDirectory) {
			let filePath = directoryPath + file;

			fileTasks.push(
				fs.stat(path.join(fullFolderPath, file)).then(async fileInfo => {
					if (fileInfo.isDirectory()) {
						await indexFolder(filePath + "/");
					} else {
						processFile(file, filePath);
					}

					remaining--;
					if (remaining == 0) finished();
				})
			);
		}

		await finishedPromise;
	}

	/**
	 * Takes a filename and checks if there is any compression type matching the file extension.
	 * Adds all matching compressions to the file.
	 * @param {string} fileName
	 * @param {string} fillFilePath
	 */
	function processFile(fileName, filePath) {
		// Remove the compression file extension in fullFilePath
		filePath = filePath.split(".");
		let compressionExtension = filePath.pop();
		filePath = filePath.join(".");

		let noExtension = filePath.split(".");
		if (noExtension.length != 1) noExtension.pop();
		noExtension = noExtension.join(".");

		let compression = compressions[compressionExtension];
		if (compression) {
			addCompressionToFile(filePath, compression, "");
			if (root != uncompressedRoot) { // The uncompressed version is in a different folder so it won't get indexed without this
				addCompressionToFile(filePath, compressions.none, "");
			}

			for (let ext of opts.extensions) {
				if (fileName.endsWith("." + ext + compression.fileExtension)) {
					let missingExtension = "." + ext;
					addCompressionToFile(noExtension, compression, missingExtension);
					if (root != uncompressedRoot) { // Same here
						addCompressionToFile(noExtension, compressions.none, missingExtension);
					}

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
		let existingFile = files[filePath];

		if (existingFile) {
			if (
				compression.encodingName == "none"
				&& (! opts.disableCompression)
				&& root != uncompressedRoot
			) { // These conditions cause the uncompressed versions to be added for each compression. Which means there can be duplicates
				if (existingFile.compressions.includes(compression)) return;
			}

			existingFile.compressions.push(compression);
		} else {
			files[filePath] = {
				compressions: [compression],
				incompletePath: filePath + missingExtension // Exclude the compression extension and the root folder so it can be swapped out later, depending on the compression mode
			};
		}
	}

	/**
	 * @param {string} encodingName
	 * @param {string} fileExtension
	 * @returns {
	 *  {encodingName:string, fileExtension:string}
	 * }
	 */
	function Compression(encodingName, fileExtension) {
		this.encodingName = encodingName;
		if (fileExtension != "") fileExtension = "." + fileExtension;
		this.fileExtension = fileExtension;
	}

	function removeEndingSlash(path) {
		if (path.at(-1) == "/") return path.slice(0, path.length - 1);

		return path;
	}
}
