const fs = require("fs");
const pathModule = require("path");
const mime = require("mime-types");

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
function expressStaticGzipMiddleware(root, uncompressedRoot, options) {
  let opts = sanitizeOptions(options);
  let compressions = [];
  let files = {};

  registerCompressions();
  indexRoot();

  return expressStaticGzip;

  function expressStaticGzip(req, res, next) {
    changeUrlFromDirectoryToIndexFile(req);

    let clientsAcceptedEncodings = req.headers["accept-encoding"];

    let path = "";
    try {
      path = decodeURIComponent(req.path);
    } catch (e) {
      res.status(400).send(e.message);
      return;
    }

    let compressedFileInfo = files[path];
    if (compressedFileInfo) {
      if (compression) {
        sendCompressed(req, res, compressedFileInfo);
        return;
      }
    }

    next();
  }

  function registerCompressions() {
    if (opts.customCompressions && opts.customCompressions.length > 0) {
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

  function sendCompressed(req, res, compressedFileInfo) {
    let compression = findEncoding(
      clientsAcceptedEncodings,
      compressedFileInfo.compressions,
      opts.orderPreference
    );

    let type = mime.extension(req.path) || "application/octet-stream"; // It's fine to use the URL like this because it's already an approved URL
    let charset = mime.charset(type);

    res.sendFile(compressedFileInfo.mainPath + compression.fileExtension, {
      headers: {
        "Content-Type": type + (charset? "; charset=" + charset : ""),
        "Content-Encoding": compression.encodingName,
        "Vary": "Accept-Encoding" // The Vary Header is required for caching proxies to work properly
      }
    });
  }

  function changeUrlFromDirectoryToIndexFile(req) {
    const parts = req.url.split('?');
    if (opts.index && parts[0].endsWith("/")) {
      parts[0] += opts.index;
      req.url = parts.length > 1 ? parts.join('?') : parts[0];
    }
  }

  function indexRoot() {
    if (compressions.length > 0) {
      findCompressedFilesInDirectory(root);
    }
  }

  function findCompressedFilesInDirectory(directoryPath) {
    if (!fs.existsSync(directoryPath)) return;

    let filesInDirectory = fs.readdirSync(directoryPath);
    for (let file of filesInDirectory) {
      let filePath = directoryPath + "/" + file;
      let stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        findCompressedFilesInDirectory(filePath);
      } else {
        addMatchingCompressionsToFile(file, filePath);
      }
    }
  }

  /**
   * Takes a filename and checks if there is any compression type matching the file extension.
   * Adds all matching compressions to the file.
   * @param {string} fileName
   * @param {string} fillFilePath
   */
  function addMatchingCompressionsToFile(fileName, fullFilePath) {
    for (let compression of compressions) {
      if (fileName.endsWith(compression.fileExtension)) {
        addCompressionToFile(fullFilePath, compression);

        for (let ext of opts.extensions) {
          if (fileName.endsWith(`.${ext}${compression.fileExtension}`)) {
            let noExtension = fullFilePath.slice(0, fullFilePath.lastIndexOf(`.${ext}`));
            addCompressionToFile(noExtension, compression, `.${ext}`);
          }
        }
        return;
      }
    }
  }

  /**
   * Adds the compression to the file's list of available compressions
   * @param {string} filePath
   * @param {Compression} compression
   */
  function addCompressionToFile(filePath, compression, missingExtension) {
    let srcFilePath = filePath
      .replace(root, "")
      .replace(compression.fileExtension, "");
    let existingFile = files[srcFilePath];

    if (existingFile) {
      existingFile.compressions.push(compression);
    } else {
      files[srcFilePath] = {
        compressions: [compression],
        mainPath: pathModule.join(__dirname, `${filePath}${missingExtension}`)
      };
      console.log(files[srcFilePath].mainPath);
    }
  }

  /**
   * Registers a new compression to the module.
   * @param {string} encodingName
   * @param {string} fileExtension
   */
  function registerCompression(encodingName, fileExtension) {
    if (!findCompressionByName(encodingName)) {
      compressions.push(new Compression(encodingName, fileExtension));
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

  /**
   * @param {string} encodingName
   * @returns {{encodingName:string, fileExtension:string}}
   */
  function findCompressionByName(encodingName) {
    for (let compression of compressions) {
      if (compression.encodingName === encodingName) {
        return compression;
      }
    }

    return null;
  }
}
