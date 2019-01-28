const fs = require('fs');
const child_process = require('child_process');

const re = /identify: Corrupt JPEG data:/;

function corrupt(p) {
	let ps = child_process.spawnSync('magick', [ 'identify', '-verbose', p ], {
		stdio: [ 'ignore', 'ignore', 'pipe' ], encoding: 'utf8' });
	if(!ps || ps.error) {
		throw p;
	}
	return re.test(ps.stderr);
}

function doit(fi) {
	if(fi['ENOENT']) {
		console.log(`${fi.path}: file not found`);
		return;
	}
	let st = null;
	if(!fi.hasOwnProperty('size') || !fi.hasOwnProperty('mtime')) {
		try {
			st = fs.statSync(fi.path);
		} catch(err) {
			fi.ENOENT = true;
			console.log(`${fi.path}: file not found`);
			return;
		}
	}
	if(!fi.hasOwnProperty('size')) {
		fi.size = st.size;
	}
	if(!fi.hasOwnProperty('mtime')) {
		fi.mtime = st.mtimeMs;
	}
	if(!fi.hasOwnProperty('corrupt')) {
		fi.corrupt = corrupt(fi.path);
	}
	if(fi.corrupt) {
		console.log(`${fi.path}: corrupted`);
	} else {
		console.log(`${fi.path}: OK`);
	}
}

function main(argv) {
	let s = fs.readFileSync(argv[1], {encoding:'utf8'});
	let arr = JSON.parse(s);
	let count = arr.length;
	let n = Number.parseInt(argv[2]);
	let start = 0;
	for(start = 0; start < count; ++start) {
		if(!arr[start].hasOwnProperty('corrupt')) {
			break;
		}
	}
	if((start + n) > count) {
		n = count - start;
	}
	if(n < 1) {
		console.log(`jpegbork: all ${count} entries have been checked; no more work to do`);
	} else {
		console.log(`jpegbork: checking entries ${start}..${start+n}, ${n} entries total...`);
		for(let i = 0; i < n; ++i) {
			doit(arr[start + i]);
		}
		s = JSON.stringify(arr, null, 2);
		let bak = argv[1] + '.bak';
		let st = null;
		try {
			st = fs.statSync(bak);
		} catch(err) {}
		if(st && st.isFile()) {
			fs.unlinkSync(bak);
		}
		fs.renameSync(argv[1], bak);
		fs.writeFileSync(argv[1], s, {encoding:'utf8'});
		}
}

main(process.argv.slice(1));
