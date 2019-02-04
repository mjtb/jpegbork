# JpegBork

Finds JPEG files that have been corrupted by our NAS.

Copyright (C) 2019 Michael Trenholm-Boyle.<br/>
Licensed under a permissive (MIT) license.<br/>
See the LICENSE file for details.


## Pre-requisites

* Node.js 10.14.1
* ImageMagick 7.0.7

Both `node` and `magick` must be in your PATH environment variable.


## Build

None required.


## Run

```
node index.js db.js count
```

The `db.js` file uses the following schema:

```
[
    {
        "path":    "filename.jpg", // path to file (required on input)
        "size":    123456,         // size in bytes (computed)
        "mtime":   1548655437649,  // file modification timestamp (computed)
        "corrupt": true            // corrupted JPEG data flag (computed)
	}
]
```

The _count_ argument gives the number of entries in `db.js` to process
in the current execution of the script.

Upon successful execution, the `db.js` file is backed up to `db.js.bak` and
then overwritten with the computed information.

Example:

```
$ node index.js db.js 10
jpegbork: checking entries 103..113, 10 entries total...
z:\Digital Frame\One\IMG_4008.JPG: OK
z:\Digital Frame\One\IMG_4080.JPG: OK
z:\Digital Frame\One\IMG_4179.JPG: OK
z:\Digital Frame\One\IMG_4184.JPG: OK
z:\Digital Frame\One\IMG_4212.JPG: OK
z:\Digital Frame\One\IMG_4229.JPG: OK
z:\Digital Frame\One\IMG_4236.JPG: corrupted
z:\Digital Frame\One\IMG_4249.JPG: OK
z:\Digital Frame\One\IMG_4268.JPG: OK
z:\Digital Frame\One\IMG_4281.JPG: OK
```

## Details

To determine if a JPEG file is corrupted, this script executes ImageMagick
using the command line: `magick identify -verbose _file_` and then checks
for the presence of the string `identify: Corrupt JPEG data:` in the `stderr`
output of the command.


## Releases

### v1.0.1

* Added timing and progress messages
* Added a Ctrl+C interrupted handler

### v1.0.0

Initial release.

## Known Issues

None at this time.
