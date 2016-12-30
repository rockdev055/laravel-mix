let path = require('path');
let File = require('./File');
let Manifest = require('./Manifest');
let Versioning = require('./Versioning');
let concatenate = require('concatenate');

module.exports = new class {
    /**
     * Create a new Laravel Mix instance. 
     */
    constructor() {
        this.File = File;
        this.hmr = false;
        this.sourcemaps = false;
        this.notifications = true;
        this.cssPreprocessor = false;
        this.inProduction = process.env.NODE_ENV === 'production';
        
        this.publicPath = this.isUsingLaravel() ? 'public' : './';
        this.cachePath = this.isUsingLaravel() ? 'storage/framework/cache' : './';
        
        this.manifest = new Manifest(this.cachePath + '/Mix.json');
        this.versioning = new Versioning(this.manifest);
    }


    /**
     * Finalize the user's webpack.mix.js configuration file.
     */
    finalize() {
        // We'll first load the user's webpack.mix.js file,
        // and apply its settings.
        require(this.configPath());

        // Since the user might wish to override the default cache 
        // path, we'll update these here with the latest values.
        this.manifest.path = this.cachePath + '/Mix.json';
        this.versioning.manifest = this.manifest;

        this.detectHotReloading();
    }    


    /**
     * Determine the Webpack entry file(s).
     */
    entry() {
        let entry = this.js.reduce((result, paths) => {
            result[paths.output.name] = paths.entry.map(src => src.path);

            return result;
        }, {});

        // If the user has requested CSS preprocessing,
        // we'll extract it into the first entry point.
        if (this.cssPreprocessor) {
            entry[Object.keys(entry)[0]].push(
                this[this.cssPreprocessor].src.path
            );
        }

        return entry;
    }


    /**
     * Determine the Webpack output path.
     */
    output() {
        let filename;

        if (this.js.vendor || this.js.length > 1) {
            filename = this.versioning.enabled ? '[name].[hash].js' : '[name].js';
        } else {
            filename = this.js[0].output[this.versioning.enabled ? 'hashedFile' : 'file'];
        }

        return {
            path: this.hmr ? '/' : this.publicPath,
            filename: path.join(this.js[0].output.base, filename).replace(this.publicPath, ''),
            publicPath: this.hmr ? 'http://localhost:8080/' : './'
        };
    }


    /**
     * Determine the appropriate CSS output path.
     */
    cssOutput() {
        let regex = new RegExp('.?/?' + this.publicPath);

        return this[this.cssPreprocessor].output[
            this.versioning.enabled ? 'hashedPath' : 'path'
        ].replace(regex, '');
    }
    

    /**
     * Minify the given files, or those from Mix.minify().
     * 
     * @param {array|null} files 
     */
    minifyAll(files = null) {
        if (! this.inProduction) return;

        files = files || this.minify || [];

        files.forEach(file => new File(file).minify());

        return this;
    }

    
    /**
     * Combine the given files, or those from Mix.combine().
     * 
     * @param {array|null} files 
     */
    concatenateAll(files = null) {
        files = files || this.combine || [];

        files.forEach(file => {
            concatenate.sync(file.src, file.output);

            if (! this.inProduction) return;

            new this.File(file.output).minify();
        });

        return this;
    }


    /**
     * Detect if the user desires hot reloading.
     */
    detectHotReloading() {
        let file = new this.File(this.cachePath + '/hot');

        file.delete();

        // If the user wants hot module replacement, we'll create 
        // a temporary file, so that Laravel can detect it, and
        // reference the proper base URL for any assets.
        if (process.argv.includes('--hot')) {
            this.hmr = true;

            file.write('hot reloading enabled');
        }
    }


    /**
     * Fetch the appropriate Babel config for babel-loader.
     */
    babelConfig() {
        let file = this.root('.babelrc');

        // If the user has defined their own .babelrc file, 
        // the babel-loader will automatically fetch it.
        // Otherwise, we'll use these defaults.
        return this.File.exists(file) ? '' : '?' + JSON.stringify({
            'cacheDirectory': true,
            'presets': [
                ['es2015', { 'modules': false }]
            ]
        });
    }
    

    /**
     * Determine the path to the user's webpack.mix.js file.
     */
    configPath() {
        return this.root('webpack.mix');
    }


    /**
     * Determine the project root.
     * 
     * @param {string|null} append
     */
    root(append = '') {
        return path.resolve(__dirname, '../../../', append);
    }


    /**
     * Determine if we are working with a Laravel project.
     */
    isUsingLaravel() {
        return this.File.exists('./artisan');
    }
};
