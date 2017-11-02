const cp = require('child_process');
const databaseSeed = require('../seeds/seed').seed;
const fs = require('fs');
const redshiftSeed = require('../seeds/redshift').seed;
const redshiftTest = require('../seeds/redshift').test;
const task = require('./task');

let build;

// The list of available commands, e.g. node tools/db.js rollback
const commands = ['version', 'migrate', 'rollback', 'migration', 'seed', 'test'];
const command = process.argv[2];

const filterLog = stdout => !stdout.match('FROM pg_class') && console.log(stdout);

// The template for database migration files (see templates/*.js)
const version = new Date().toISOString().substr(0, 16).replace(/\D/g, '');
const template = `module.exports.up = async (db) => {\n  \n};\n
module.exports.down = async (db) => {\n  \n};\n
module.exports.configuration = { transaction: true };\n`;

// Ensure that Node.js modules were installed,
// at least those required to build the app
try {
    build = require('./build');
} catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
    // Install Node.js modules with NPM
    cp.spawnSync('npm', ['install', '--no-progress'], { stdio: 'inherit' });

    // Clear Module's internal cache
    try {
        const Module = require('module');
        const m = new Module();
        // eslint-disable-next-line
        m._compile(fs.readFileSync('./tools/build.js', 'utf8'), path.resolve('./tools/build.js'));
    } catch (error) { } // eslint-disable-line

    // Reload dependencies
    build = require('./build');
}

module.exports = task('db', () =>
    new Promise((resolve, reject) => {
        build({
            watch: false,
            webpack: false,
            onComplete() {
                const database = require('../build/schema/database');
                const redshift = require('../build/schema/redshift');

                if (!commands.includes(command)) {
                    throw new Error(`Unknown command: ${command}`);
                }

                switch (command) {
                case 'migration':
                    fs.writeFileSync(
                        `migrations/${version}_${process.argv[3] || 'new'}.js`,
                        template,
                        'utf8',
                    );
                    break;
                case 'version':
                    database.base.databaseVersion()
                        .then((databaseVersion) => {
                            console.log('VERSION', databaseVersion);
                            database.base.close();
                            resolve();
                        });
                    break;
                case 'rollback':
                case 'seed':
                    database
                        .syncDatabase(true, {
                            logging: filterLog,
                        })
                        .then(() => databaseSeed(database))
                        .then(() => redshift
                            .syncDatabase(true, {
                                logging: filterLog,
                            })
                            .then(() => redshiftSeed(database,redshift.base)))
                        .then(() => {
                            console.log("close")
                            database.base.close();
                            redshift.base.close();
                            resolve();
                        });
                    break;
                case 'test':
                    redshift
                        .syncDatabase(false, {
                            logging: filterLog,
                        })
                        .then(() => database.syncDatabase(false, {
                            logging: filterLog,
                        }))
                        .then(() => redshiftTest(database, redshift))
                        .then(() => {
                            database.base.close();
                            redshift.base.close();
                            resolve();
                        })
                        .catch((err) => {
                            console.log(err);
                            reject(err);
                        });
                    break;
                default:
                }
            },
        });
    }),
);
