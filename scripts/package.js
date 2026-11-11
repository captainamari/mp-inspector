const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { version } = require('../package.json');
fs.rmSync('artifacts', { recursive: true, force: true });
fs.mkdirSync('artifacts');
const output = path.resolve('artifacts');
for (const name of ['mp-inspector', 'mp-inspector-lite']) {
  // Run npm through its JS entry for portability (including Windows).
  execFileSync(process.execPath, [process.env.npm_execpath, 'pack', '--ignore-scripts', '--pack-destination', output],
    { cwd: path.join('dist', name), stdio: 'inherit' });
}
const sums = ['mp-inspector', 'mp-inspector-lite'].map(name => {
  const file = name + '-' + version + '.tgz';
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex') + '  ' + file;
});
fs.writeFileSync(path.join(output, 'SHA256SUMS'), sums.join('\n') + '\n');
fs.copyFileSync('dist/build-report.json', path.join(output, 'build-report.json'));
