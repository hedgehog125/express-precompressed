# express-precompressed
Npm page: [express-precompressed](https://www.npmjs.com/package/express-precompressed) <br>
Thanks TK and the other contributors for making the original repository: [express-static-gzip](https://github.com/tkoenig89/express-static-gzip)

---

express-precompressed is an express middleware for serving precompressed (or uncompressed) files with the correct headers. The code is based off of express-static-gzip, but it's been adapted to use express' sendFile method instead of serve-static. This slightly reduced the total number of dependencies, and also gave me the flexibility I needed to support some new features. 

Speaking of which, the 3 new features are: <br>
* Fallback extension support
* The uncompressed files can now be served from a separate folder, helping you keep things organised
* A dedicated uncompressed mode, allowing you to use the same middleware during development

And like the original, express-precompressed supports *gzip*, *brotli* and can be configured for *any other* formats. It's also resource efficient as it indexes on startup and doesn't have to compress the files as they are sent.


# Requirements
Unlike the original, express-precompressed can be used in an uncompressed mode, meaning you can even use it while you're developing your website. This makes the basic setup quite easy (as explained in Getting Started).

But like the original, it still requires you compress each file yourself when you want to enable compression. Further instructions are also in Getting Started.


# Install
As usual it's:
```bash
npm install express-precompressed
```
(Apparently you don't need the --save anymore)

# Getting Started
Once you've installed the package as explained above, import it with 
```js
const serveCompressed = require("express-precompressed");
```
And then call it like this:

```js
...

/*
    root -> The path to where you'll later put the compressed files.
	These should have the original names just with the compression extension added onto the end

    uncompressedRoot -> The path to your fallback, uncompressed files you want to serve.
	These are also used when you disable compression.
	I'd recommend using a different folder to root to keep things organised
*/
app.use(serveCompressed(<root>, <uncompressedRoot>, { // <-- Options
	/*
	This option works the same way as express.static:
	I use the option here so that visiting /foo for example, would result in foo.html being sent
	(unless you have a file called foo with no extension that is).
	You might want to remove this option if you don't want this behaviour.
		\/ \/ \/
	*/
	extensions: ["html"],
	disableCompression: true
}));

// Your express routes and app.listen call
```
**Note**: the paths currently have to be relative. <br>
**Note**: The angle brackets are part of the template rather than being a special syntax.

This should behave more or less identically to express.static as `disableCompression` means it just serves the files in uncompressedRoot instead. This is how you do the very quick testing setup I mentioned previously. However, when you want to make a production version, you obviously want to actually enable the compression. You can do this by simply setting `disableCompression` to false. But, I'd suggest using a setup like this...

```js
...
disableCompression: ! config.serve.gzip // Or you might want to use an environment variable
...
```

The second and third arguments to the middleware function are optional, so if you always want compression and don't want fallbacks you can also do:

```js
app.use(serveCompressed(<root>));
```

<br>
And that folder obviously also needs to contain the compressed files. It's relatively easy to write a program to compress them all, but I might try and adapt my custom one for general use in the future. You can also use a bash command like gzip or just compress them individually. Just make sure all the file name are the same (but with the compression extension on the end) and the folder structure is the same.

<br>

One other thing: gzip compression support is enabled by default, but you *have to enable brotli* with this in your options:

```js
...
enableBrotli: true
...
```

If you want to add custom compressions, see below.


# More advanced use cases
## Compression
Other compression formats can be added with the `customCompressions` option. For example, to add deflate support, just add this to your options:

```js
...
customCompressions: [
	{
		encodingName: "deflate", // The name used in the http accept-encoding header
		fileExtension: "zz" // Make sure you don't start it with a dot
	}
]
...
```
**Note**: this doesn't override the serving of gzip and brotli files.

You can also override the client's priority for different compressions with the `orderPreference` option. It goes from highest to lowest preference. Having `"br"` near the start like in the default, is currently somewhat necessary as most browsers don't seem to send a preference, and brotli offers better compression than gzip. You can still set this to an empty array though.

**Note**: other preferred formats and the client's preferred formats will be fallen back to if a preferred format isn't available for a file.

## Scoping to specific URL templates
There's nothing special about the way you do it here but here's an example:

```js
app.use("/static/", serveCompressed("gzippedFiles", "uncompressedFiles", {
	extensions: ["html"]
}));
```
You just put a path for the 1st argument in app.use and move the middleware to the second argument.

## A slight optimisation trick
If you've got enough files that your server is taking a second to handle the first request, that's probably because the middleware's still indexing. Normally this takes less than 20 milliseconds but it can be more depending on the number of files and the speed of your server.

One thing you can do to help with this, even if you just really want to shave off a few milliseconds, is to create the middleware right at the start of your program. This is because the middleware indexes asynchronously in the background, but it has to pause handling a request if it hasn't finished yet. And that which can create a delay. By preparing the middleware early, it should be able to do at least some work in the background. This should work especially well if you're waiting for a lot of promises, ideally if they don't involve reading files.

So your code should look something like this...

```js
...
const main = async _ => {
	let preparedStaticMiddleware = serveCompressed(<root>);
	await someOtherSetupProcess();

	app.use(preparedStaticMiddleware);
	/* ^^^
	Note that the middleware function is always technically 'ready'.
	So even if it doesn't have enough time to index beforehand, it'll just cause the delay
	*/

	// Set up the routes and call app.listen etc.
	...
};
main();
...
```


# Breaking changes
## 0.2.0
express.static is now used when compression is disabled. The only difference due to this should be that it detects new files (which can be helpful for development). But if you like, you can revert to the old behaviour by setting `options.useBuiltInWhenDisabled` to false.

I also incorrectly claimed in the previous version that you needed to replicate the base path with folders. So now just put the files in the base folder.

# A few things to note
**Slight warning**: There's currently no special treatment for dot files, so they can be requested by the client. This is a feature I plan to add soon, and it will behave the same way as in express.static, with the same default.

This package is currently in preview so please report any bugs on GitHub, and contribute to the repository if you want. I don't have any experience with testing tools so if someone wants to try and update the previous tests, that would be really helpful. I previously removed them due to the dependancies having vulnerabilities, but the tests need updating anyway due to the new syntax.

There's potentially also security issues. Probably mainly around the treatment of URLs. Help with this would also be good, although I do also plan on looking into it myself as well. So keep that in mind if security is really important, although I don't accept liability either way.

As with the original, unless you've scoped the middleware to a specific base path, the path "/" will result in sending the file set in the `index` option. Which can result in issues if you're serving a REST API from this server. You can either disable serving an index file by setting `index` to `false` in the options. Or you can register it after your route or middleware on that path.

And lastly, this one isn't too important: the files are only indexed when the middleware is first run. So any changes won't be detected.


# Available options
* **`enableBrotli`**: boolean (default: **false**)

    Enables support for the brotli compression, using the file extension "br".

* **`disableCompression`**: boolean (default: **false**)

    Disables serving with compression and instead just serves the `uncompressedRoot` folder (the second argument in the middleware function). This can be useful for testing as you can set it to your build output folder, or just where you put your HTML source files.
    
* **`extensions`**: string[]

    Fallback extensions to be used if a file can't be found. These are added on in turn until a match is found (during indexing), or none are found, resulting in the request being handled by the next middleware or route (or more likely sending a 404). For example, I like to use `["html"]` in order to for example send, "foo.html" in response for a request to just "/foo".

* **`useBuiltInWhenDisabled`**: boolean (default: **true**)

    If express.static should be used instead of the custom solution when compression is disabled. The only difference should be that express.static detects new files, which can be helpful during development. 

* **`index`**: boolean **or** string (default: "index.html")

    By default this module will send "index.html" files in response to a request on a directory (URL ending with "/"). To disable behaviour, set this to false. Or you can supply a different index file with a relative path (e.g "index.htm").

* **`customCompressions`**: [{encodingName: string, fileExtension: string}]

    Using this option, you can add any other compressions you like. `encodingName` needs to be a valid `Accept-Encoding` heading value, as otherwise this compression will never be sent to the client. The `fileExtension` is used to find files using this compression and it **shouldn't** start with a dot.

* **`orderPreference`**: string[] (default: ["br"])

    This options allows overwriting the client's requested encoding preference (see [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding)) with a server side preference. Any encoding listed in `orderPreference` will be used first (if supported by the client) before falling back to the client's supported encodings. The order of entries in `orderPreference` is taken into account. The default value of `["br"]` will only affect things if brotli compression is available, supported and enabled. It's the default due to it having smaller sizes than gzip and browsers generally not indicating any preferences.


# Possible new features
    * Dot files handling and options (almost certainly)
    * Proper error handling and warnings
    * Slight optimisations
    * Absolute file path support
    * Custom headers (function and object versions)
    * Weak server preferences (would only apply when client has no preferences).
	Alternatively, weights that are compared to the client's...?
