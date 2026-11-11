const fs = require('node:fs');
const path = require('node:path');
const variant = process.argv[2] || 'source';
const sources = { source: 'src', full: 'dist/mp-inspector', lite: 'dist/mp-inspector-lite' };
if (!sources[variant]) throw new Error('Expected source, full or lite');
const target = 'demo/lib/mp-inspector';
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
for (const directory of ['core', 'components', 'utils']) {
  fs.cpSync(path.join(sources[variant], directory), path.join(target, directory), { recursive: true });
}
console.log('Demo synchronized from ' + sources[variant]);
