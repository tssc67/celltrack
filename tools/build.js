#!/usr/bin/env node
const babel = require('babel-core');
const chokidar = require('chokidar');
const cp = require('child_process');
const fs = require('fs');
const juice = require('juice');
const mkdirp = require('mkdirp');
const path = require('path');
const rimraf = require('rimraf');
const slash = require('slash');
const task = require('./task');

const delay100ms = (timeout => (callback) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(callback, 100); // eslint-disable-line no-param-reassign
})();

module.exports = task(
    'build',
    ({ watch = false, onComplete } = {}) =>
        new Promise((resolve) => {
            let ready = false;

            // Clean up the output directory
            rimraf.sync('build/*', { nosort: true, dot: true });

            // Makedir for config
            mkdirp.sync('build/config');

            let watcher = chokidar.watch([
                'src',
                'config',
                'package.json',
            ]);
            watcher.on('all', (event, src) => {
                src = slash(src);
                // Reload the app if package.json file have changed (in watch mode)
                if (src === 'package.json') {
                    if (ready && onComplete) delay100ms(onComplete);
                    return;
                }
                // if( /\.deps/.test(src)) return;
                // Skip files starting with a dot, e.g. .DS_Store, .eslintrc etc.
                if (path.basename(src)[0] === '.') return;

                // Get destination file name, e.g. src/app.js (src) -> build/app.js (dest)
                const dest = src.startsWith('src')
                    ? `build/${path.relative('src', src)}`
                    : `build/${src}`;

                try {
                    switch (event) {
                    // Create a directory if it doesn't exist
                    case 'addDir':
                        if (src.startsWith('src') && !fs.existsSync(dest)) mkdirp(dest);
                        if (ready && onComplete) onComplete();
                        break;

                    // Create or update a file inside the output (build) folder
                    case 'add':
                    case 'change':
                        if (src.startsWith('src') && src.endsWith('.js')) {
                            const { code, map } = babel.transformFileSync(src);
                            // Enable source maps
                            const data = (src === 'src/server.js' ?
                                "require('source-map-support').install(); " : '') + code +
                                (map ? `\n//# sourceMappingURL=${path.basename(src)}.map\n` : '');
                            fs.writeFileSync(dest, data, 'utf8');
                            console.log(src, '->', dest);
                            if (map) {
                                fs.writeFileSync(`${dest}.map`, JSON.stringify(map), 'utf8');
                            }
                        } else if (
                            src.startsWith('src') 
                            && (src.endsWith('.c')
                            || src.endsWith('.cpp')) 
                        ) {
                            
                        } else if (src.startsWith('src') || src.startsWith('config')) {
                            const data = fs.readFileSync(src);
                            fs.writeFileSync(dest, data);
                            console.log(src, '->', dest);
                        }
                        if (ready && onComplete) delay100ms(onComplete);
                        break;

                    // Remove directory if it was removed from the source folder
                    case 'unlinkDir':
                        if (fs.existsSync(dest)) fs.rmdirSync(dest);
                        if (ready && onComplete) onComplete();
                        break;

                    default:
                    // Skip
                    }
                } catch (err) {
                    console.log(err.message);
                }
            });

            watcher.on('ready', () => {
                ready = true;
                if (onComplete) onComplete();
                if (!watch) watcher.close();
                resolve();
            });

            function cleanup() {
                if (watcher) {
                    watcher.close();
                    watcher = null;
                }
            }

            process.on('SIGINT', cleanup);
            process.on('SIGTERM', cleanup);
            process.on('exit', cleanup);
        }),
);
