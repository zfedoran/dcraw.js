// WARNING: Don't use fancy ES6 in this file, the EMSCRIPTEN minifier does not support it yet.

const EM_RAW_OPTIONS = {
    verbose: 'v',                    //<boolean>  Print verbose messages
    identify: 'i',                   //<boolean>  Identify files without decoding them (use with '-v' to identify files and show metadata)
    toStandardOutput: 'c',           //<boolean>  Write image data to standard output
    extractThumbnail: 'e',           //<boolean>  Extract embedded thumbnail image
    updateFileDate: 'z',             //<boolean>  Change file dates to camera timestamp
    useCameraWhiteBalance: 'w',      //<boolean>  Use camera white balance, if possible
    useAverageWhiteBalance: 'a',     //<boolean>  Average the whole image for white balance
    whiteBalanceBox: 'A',            //<x y w h>  Average a grey box for white balance
    useCustomWhiteBalance: 'r',      //<r g b g>  Set custom white balance
    useEmbeddedColorMatrix: 'M',     //<boolean>  Use/don't use an embedded color matrix
    correctChromaticAberration: 'C', //<r b>      Correct chromatic aberration
    deadPixelFile: 'P',              //<buffer>   Fix the dead pixels listed in this file
    darkFrameFile: 'K',              //<buffer>   Subtract dark frame (16-bit raw PGM)
    setDarknessLevel: 'k',           //<num>      Set the darkness level
    setSaturationLevel: 'S',         //<num>      Set the saturation level
    setWaveletThreshold: 'n',        //<num>      Set threshold for wavelet denoising
    setHighlightMode: 'H',           //[0-9]      Highlight mode (0=clip, 1=unclip, 2=blend, 3+=rebuild)
    setFlipMode: 't',                //[0-7]      Flip image (0=none, 3=180, 5=90CCW, 6=90CW)
    setColorSpace: 'o',              //[0-6]      Output colorspace (raw,sRGB,Adobe,Wide,ProPhoto,XYZ,ACES)
    setICCFromFile: 'o',             //<buffer>   Apply output ICC profile from file
    setICCFromCamera: 'p',           //<buffer>   Apply camera ICC profile from file or "embed"
    useDocumentMode: 'd',            //<boolean>  Document mode (no color, no interpolation, no debayer)
    useRawMode: 'D',                 //<boolean>  Document mode without scaling (totally raw)
    useExportMode: 'E',              //<boolean>  Document mode without cropping
    setNoStretchMode: 'j',           //<boolean>  Don't stretch or rotate raw pixels
    setNoAutoBrightnessMode: 'W',    //<boolean>  Don't automatically brighten the image
    setBrightnessLevel: 'b',         //<num>      Adjust brightness (default = 1.0)
    setCustomGammaCurve: 'g',        //<p ts>     Set custom gamma curve (default = 2.222 4.5)
    setInterpolationQuality: 'q',    //[0-3]      Set the interpolation quality
    setHalfSizeMode: 'h',            //<boolean>  Half-size color image (twice as fast as "-q 0")
    setFourColorMode: 'f',           //<boolean>  Interpolate RGGB as four colors
    setMedianFilter: 'm',            //<num>      Apply a 3x3 median filter to R-G and B-G
    setImageCount: 's',              //[0..N-1]   Select one raw image or "all" from each file
    use16BitMode: '6',               //<boolean>  Write 16-bit instead of 8-bit
    use16BitLinearMode: '4',         //<boolean>  Linear 16-bit, same as "-6 -W -g 1 1"
    exportAsTiff: 'T',               //<boolean>  Write TIFF instead of PPM
}

var Module = Object.assign((Module || {}), {
    preRun: function() {
        // Override the default output location so that we can return it.
        const stdout_list = [];
        Module.print = function(msg) { stdout_list.push(msg); }

        Module.dcraw = function (raw_file, options) {

            // We need a raw file buffer to continue...
            if (!raw_file) {
                throw new Error('em_dcraw: No raw file buffer provided.')
            }

            // Convert options to dcraw formatted options object
            if (options) {
                options = Object.assign({}, options);

                Object.keys(options).forEach(function(name) {
                    if (EM_RAW_OPTIONS[name]) {
                        options[EM_RAW_OPTIONS[name]] = options[name];
                        delete options[name];
                    }
                })
            }

            // Create a workspace directory in the emscripten virtual file system and go to it
            FS.mkdir('/workspace');
            FS.chdir('/workspace');

            // Link a filename to a buffer (helper method)
            function add_to_memfs(name, buf) {
                // Buffers are not copied by emscripten, this is not actually a
                // write but simply creates a reference to the buffer in MEMFS.
                const stream = FS.open(name, 'w+');
                FS.write(stream, buf, 0, buf.length, 0, true);
                FS.close(stream);
            }

            // Build the arguments array for the main() method
            const args = [];
            if (options) {

                if (options.P) {
                    add_to_memfs('dead_pixel_buf', raw_file);
                }
                if (options.K) {
                    add_to_memfs('dark_frame_buf', raw_file);
                }
                if (options.o) {
                    add_to_memfs('output_iic_buf', raw_file);
                }
                if (options.p) {
                    add_to_memfs('camera_iic_buf', raw_file);
                }

                // Create the arguments list for main() method
                for (var prop in options) {
                    const val = options[prop];
                    if (val !== undefined) {
                        // Handle boolean flags that don't need values
                        if (prop.match(/[v c e i z w a M d D j W h f 6 4 T]/) && val) {
                            args.push('-' + prop);
                            continue;
                        }

                        // Add the flag (followed by a value)
                        args.push('-' + prop);

                        // Handle inputs that are not boolean or buffers
                        if (prop.match(/[A r C k S n H t o b g q m s]/)) {

                            // Split the value into an array, and concat with the args
                            args = args.concat(val.toString().split(/\s/));
                        }

                        // Handle buffer inputs (we specify our own filenames for MEMFS)
                        if (prop === 'P') {
                            args.push('dead_pixel_buf');
                        }
                        if (prop === 'K') {
                            args.push('dark_frame_buf');
                        }
                        if (prop === 'o') {
                            args.push('output_iic_buf');
                        }
                        if (prop === 'p') {
                            args.push('camera_iic_buf');
                        }
                    }
                }
            }

            // Add the RAW file to the args list
            if (raw_file) {
                add_to_memfs('raw_buf', raw_file);
                args.push('raw_buf');
            } 

            // Clear the stdout_list (in case this function was called again)
            stdout_list.length = 0;
            run(args);

            // Remove the source image from the workspace
            if (raw_file) {
                FS.unlink('raw_buf');
            }

            // Remove optional files from the workspace
            if (options) {
                if (options.P) {
                    FS.unlink('dead_pixel_buf');
                }
                if (options.K) {
                    FS.unlink('dark_frame_buf');
                }
                if (options.o) {
                    FS.unlink('output_iic_buf');
                }
                if (options.p) {
                    FS.unlink('camera_iic_buf');
                }
            }

            // Get the output files and remove the workspace from the virtual file system
            var num_files = 0;
            const output_files = {};
            const workspace = FS.readdir('/workspace');
            for (var index in workspace) {
                const name = workspace[index];
                if (name !== '.' && name !== '..') {
                    output_files[name] = FS.readFile(name, { encoding: 'binary' });
                    FS.unlink(name);
                    num_files++;
                }
            }

            // Clean up the virtual file system in case of re-entry
            FS.chdir('/');
            FS.rmdir('/workspace');

            if (num_files === 1) {
                return Object.values(output_files).pop();
            }
            if (num_files > 1) {
                return output_files;
            }

            return stdout_list.join('\n');
        }

        // Wrapper for invoking main() method
        function run(args) {
            args = args || [];

            ensureInitRuntime();

            var argc = args.length + 1;
            var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL),0,0,0];
            for (var i = 0; i < argc - 1; i = i + 1) {
                argv = argv.concat([allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL), 0,0,0]);
            }
            argv.push(0);
            argv = allocate(argv, 'i32', ALLOC_NORMAL);

            return Module['_main'](argc, argv, 0);
        }
    }
});
