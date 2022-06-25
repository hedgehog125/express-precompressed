// Type definitions for express-static-gzip 2.0
/* =================== USAGE ===================

	import * as expressStaticGzip from "express-static-gzip";
	app.use(expressStaticGzip("wwwroot", {enableBrotli: true, index: 'index.htm'}))

 =============================================== */

/**
 * Generates a middleware function to serve precompressed or uncompressed files. Put the compressed files in the `root` folder you specified and the uncompressed in the `uncompressedRoot` folder you specified. You can also set them to the same folder, which is the default for uncompressedRoot. But I'd recommend keeping them separate to organise things. 
 * @param { string } root: The path to the folder containing your compressed files. These should have the original names just with the compression extension added onto the end.
 * @param { string } uncompressedRoot: The path to your fallback, uncompressed files you want to serve. These are also used when you disable compression. I'd recommend using a different folder to root to keep things organised. Any files unique to this folder won't be served unless compression is off. In which case this folder will be indexed instead (which can be useful for testing).
 * @param { expressStaticGzip.ExpressStaticGzipOptions } options: Options to change the middleware's behaviour
 * @returns express middleware function
 */
 declare function expressPrecompressed(root: string, uncompressedRoot : string, options: expressStaticGzip.ExpressStaticGzipOptions): (req: any, res: any, next: any) => any;

 declare namespace expressStaticGzip {
 
	 /**
	  * Options to configure an `expressStaticGzip` instance.
	  */
	 interface ExpressStaticGzipOptions {
 
		/**
		  * Add any other compressions not supported by default. 
		  * `encodingName` will be checked against the request's Accept-Header. 
		  * `fileExtension` is used to find files using this compression.
		  * `fileExtension` does not require a dot (e.g. 'gz' not '.gz').
		  * @default null
		*/
		customCompressions?: Compression[];
 
		/**
		  * Enables support for the brotli compression, using file extension 'br' (e.g. 'index.html.br'). 
		  * @default false
		*/
		enableBrotli?: boolean;

		/**
		  * Disables serving with compression and instead just serves the `uncompressedRoot` folder (the second argument in the middleware function). This can be useful for testing as you can set it to your build output folder, or just where you put your HTML source files. 
		  * @default false
		*/
		disableCompression?: boolean;
 
		/**
		  * By default this module will send "index.html" files in response to a request on a directory. 
		  * To disable this set false or to supply a new index pass a string.
		  * @default "index.html"
		*/
		index?: boolean | string;
 
		/**
		  * Allows overwriting the client's requested encoding preference 
		  * (see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding)) 
		  * with a server side preference. Any encoding listed in orderPreference will be 
		  * used first (if supported by the client) before falling back to the client's supported encodings. 
		  * The order of entries in orderPreference is taken into account.
		  * @default ["br"]
		*/
		orderPreference?: string[];
 
		/**
		  * Extensions to use when none was provided in the request and it doesn't match with a file
		  * @default null
		*/
		extensions?: string[];

		/**
		  * If express.static should be used instead of the custom solution when compression is disabled. The only difference should be that express.static detects new files, which can be helpful during development. Defaults to true
		  * @default true
		*/
		useBuiltInWhenDisabled?: boolean;
	 }
 
	 interface Compression {
		 /**
		  * Will be checked against the request's Accept-Header. 
		  */
		 encodingName: string;
 
		 /**
		  * Is used to find files using this compression.
		  */
		 fileExtension: string;
	 }
 }
 
 export = expressPrecompressed;