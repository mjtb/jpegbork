const util = require('util');
const fs = require('fs');
const child_process = require('child_process');

const re = /identify: Corrupt JPEG data:/;

var retry_enoent = true;

function JpegBork(argv) {
	this.dbfile = argv[1];
	this.count = Number.parseInt(argv[2]);
	this.files = [];
	this.total = 0;
	this.first = 0;
	this.index = -1;
	this.start_time = new Date();
	this.interrupted = false;
}

JpegBork.prototype.start = function () {
	if (process.platform === "win32") {
		var rl = require("readline").createInterface({
			input: process.stdin,
			output: process.stdout
		});
		rl.on("SIGINT", function () {
			process.emit("SIGINT");
		});
	}
	process.on("SIGINT", this._interrupt.bind(this));
	fs.readFile(this.dbfile, {
		encoding: 'utf8'
	}, this._start_2.bind(this));
};

JpegBork.prototype._interrupt = function () {
	if(this.interrupted) {
		console.error('jpegbork: aborting');
		process.exit(1);
	} else {
		console.debug('jpegbork: Ctrl+C caught: press again to abort');
		this.interrupted = true;
	}
};

JpegBork.prototype._start_2 = function (err, data) { // fs.readFile
	if (err) {
		console.error(util.inspect(err));
		process.exit(1);
	} else {
		this.files = JSON.parse(data);
		this.total = this.files.length;
		let f = 0;
		for (f = 0; f < this.total; ++f) {
			let fi = this.files[f]
			if (!fi.hasOwnProperty('corrupt')) {
				break;
			}
		}
		this.first = f;
		if ((this.first + this.count) > this.total) {
			this.count = this.total - this.first;
		}
		if (this.count < 1) {
			console.log(`jpegbork: all ${this.total} entries have been checked; no more work to do`);
			let corrupted = 0,
				uncorrupted = 0;
			for (let i = 0; i < this.total; ++i) {
				if (this.files[i].hasOwnProperty('corrupt')) {
					if (this.files[i].corrupt) {
						++corrupted;
						if (corrupted == 1) {
							console.log('listing corrupted items:');
						}
						console.log(`${this.files[i].path}`);
					} else {
						++uncorrupted;
					}
				}
			}
			if (corrupted > 0) {
				console.log(`${corrupted} corrupt items found out ${this.total} total`);
			}
			process.exit(0);
		} else {
			console.log(`jpegbork: checking entries ${this.first}..${this.first+this.count}, ${this.count} entries total...`);
			this._next();
		}
	}
};

JpegBork.prototype._next = function () {
	++this.index;
	if (this.interrupted || (this.index >= this.count)) {
		return this._last();
	}
	let fi = this.files[this.first + this.index];
	if (fi['ENOENT']) {
		if (retry_enoent) {
			delete fi.ENOENT;
		} else {
			console.log(`${fi.path}: file not found`);
			return this._next();
		}
	}
	if (!fi.hasOwnProperty('size') || !fi.hasOwnProperty('mtime')) {
		try {
			fs.stat(fi.path, {}, this._next_2.bind(this));
		} catch (err) {
			fi.ENOENT = true;
			console.log(`${fi.path}: file not found`);
			return this._next();
		}
	} else {
		return this._next_3(fi);
	}
};

JpegBork.prototype._next_2 = function (err, st) { // fs.stat(fi.path, ...)
	if(this.interrupted) {
		return this._last();
	}
	let fi = this.files[this.first + this.index];
	if (err) {
		fi.ENOENT = true;
		console.log(`${fi.path}: file not found`);
		return this._next();
	}
	if (!fi.hasOwnProperty('size')) {
		fi.size = st.size;
	}
	if (!fi.hasOwnProperty('mtime')) {
		fi.mtime = st.mtimeMs;
	}
	return this._next_3(fi);
};

JpegBork.prototype._next_3 = function (fi) {
	if(this.interrupted) {
		return this._last();
	}
	if (!fi.hasOwnProperty('corrupt')) {
		return this._is_corrupt(fi, this._next_4.bind(this));
	} else {
		return this._next();
	}
};

JpegBork.prototype._is_corrupt = function (fi, callback) { // callback(fi)
	let ps = null;
	try {
		ps = child_process.spawnSync('magick', ['identify', '-verbose', fi.path], {
			stdio: ['ignore', 'ignore', 'pipe'],
			encoding: 'utf8'
		});
	} catch(err) {
		return callback(err, fi);
	}
	if(!ps) {
		return callback(new Error('child_process.spawnSync returned null'), fi);
	} else if(ps.error) {
		return callback(ps.error, fi);
	} else {
		fi.corrupt = re.test(ps.stderr);
		return callback(null, fi);
	}
};

JpegBork.prototype._next_4 = function (err, fi) { // this.corrupt(fi, ...)
	if(err) {
		console.error(util.inspect(err));
		return this._next();
	} else if (fi.corrupt) {
		console.log(`${fi.path}: corrupted`);
	} else {
		console.log(`${fi.path}: OK`);
	}
	if ((this.index % 10) == 9) {
		let sec = ((new Date()).valueOf() - this.start_time.valueOf()) / 1000.0;
		console.log(`${this.index+1} of ${this.count} items processed in ${sec} seconds`);
	}
	return this._next();
};

JpegBork.prototype._last = function () {
	let sec = ((new Date()).valueOf() - this.start_time.valueOf()) / 1000.0;
	console.log(`${this.index} items processed in ${sec} seconds`);
	let corrupted = 0,
		uncorrupted = 0;
	for (let i = 0; i < this.total; ++i) {
		if (this.files[i].hasOwnProperty('corrupt')) {
			if (this.files[i].corrupt) {
				++corrupted;
			} else {
				++uncorrupted;
			}
		}
	}
	console.log(`${corrupted} corrupt items found out of ${corrupted+uncorrupted}/${this.total} checked so far`);
	this.bakfile = this.dbfile + '.bak';
	try {
		return fs.stat(this.bakfile, {}, this._last_2.bind(this));
	} catch (err) {
		console.error(util.inspect(err));
		process.exit(1);
	}
};

JpegBork.prototype._last_2 = function (err, st) { // fs.stat(this.bakfile, ...)
	if (!err && st && st.isFile()) {
		return fs.unlink(this.bakfile, this._last_3.bind(this));
	} else {
		return this._last_3(null);
	}
};

JpegBork.prototype._last_3 = function (err) { // fs.unlink(this.bakfile, ...)
	if (err) {
		console.error(util.inspect(err));
	}
	return fs.rename(this.dbfile, this.bakfile, this._last_4.bind(this));
};

JpegBork.prototype._last_4 = function (err) { // fs.rename(this.dbfile, this.bakfile, ...)
	if (err) {
		console.error(util.inspect(err));
		process.exit(1);
	} else {
		let s = JSON.stringify(this.files, null, 2);
		return fs.writeFile(this.dbfile, s, {
			encoding: 'utf8'
		}, this._last_5.bind(this));
	}
};

JpegBork.prototype._last_5 = function (err) { // fs.writeFile(this.dbfile, s, ...)
	if (err) {
		console.error(util.inspect(err));
		process.exit(1);
	} else {
		process.exit(0);
	}
};

var program = new JpegBork(process.argv.slice(1));
program.start();
