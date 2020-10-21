import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';
export function run() {
    // Create the mocha test
    var mocha = new Mocha({
        ui: 'tdd',
        color: true
    });
    var testsRoot = path.resolve(__dirname, '..');
    return new Promise(function (c, e) {
        glob('**/**.test.js', { cwd: testsRoot }, function (err, files) {
            if (err) {
                return e(err);
            }
            // Add files to the test suite
            files.forEach(function (f) { return mocha.addFile(path.resolve(testsRoot, f)); });
            try {
                // Run the mocha test
                mocha.run(function (failures) {
                    if (failures > 0) {
                        e(new Error(failures + " tests failed."));
                    }
                    else {
                        c();
                    }
                });
            }
            catch (err) {
                console.error(err);
                e(err);
            }
        });
    });
}
