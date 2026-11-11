const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { files } = require('../scripts/files');
const root = path.resolve(__dirname, '..');

for (const target of ['src', 'dist/mp-inspector', 'dist/mp-inspector-lite']) {
  test(target + ': local module and component paths resolve without runtime dependencies', () => {
    const directory = path.join(root, target);
    for (const filename of files(directory)) {
      if (filename.endsWith('.js')) {
        const text = fs.readFileSync(filename, 'utf8');
        assert.doesNotThrow(() => new vm.Script(text, { filename }));
        for (const match of text.matchAll(/require\(["']([^"']+)["']\)/g)) {
          assert.ok(match[1].startsWith('.'), filename + ': external dependency ' + match[1]);
          assert.ok(fs.existsSync(path.resolve(path.dirname(filename), match[1] + '.js')), filename + ': missing ' + match[1]);
        }
      }
      if (filename.endsWith('.json')) {
        const json = JSON.parse(fs.readFileSync(filename, 'utf8'));
        for (const reference of Object.values(json.usingComponents || {})) {
          for (const ext of ['.js', '.json', '.wxml', '.wxss']) {
            assert.ok(fs.existsSync(path.resolve(path.dirname(filename), reference + ext)), reference + ext);
          }
        }
      }
    }
  });
}

test('distribution metadata, license and documentation links are complete', () => {
  const pkg = require('../package.json');
  for (const target of ['dist/mp-inspector', 'dist/mp-inspector-lite']) {
    const directory = path.join(root, target);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    assert.equal(manifest.version, pkg.version);
    assert.equal(require(path.join(directory, 'core/version')), pkg.version);
    assert.equal(manifest.license, 'MIT');
    assert.equal(manifest.dependencies, undefined);
    assert.match(fs.readFileSync(path.join(directory, 'LICENSE'), 'utf8'), /Copyright \(c\) 2026 captainamari/);
    for (const filename of files(directory).filter(name => name.endsWith('.md'))) {
      const markdown = fs.readFileSync(filename, 'utf8');
      for (const match of markdown.matchAll(/\]\(([^)]+)\)/g)) {
        const link = match[1];
        if (/^(https?:|#)/.test(link)) continue;
        assert.ok(fs.existsSync(path.resolve(path.dirname(filename), link.split('#')[0])), filename + ': broken link ' + link);
      }
    }
  }
});

test('demo synchronization replaces stale files and accepts both distributions', () => {
  const target = path.join(root, 'demo/lib/mp-inspector');
  for (const variant of ['full', 'lite', 'source']) {
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'stale.js'), 'stale');
    execFileSync(process.execPath, ['scripts/sync-demo.js', variant], { cwd: root });
    assert.equal(fs.existsSync(path.join(target, 'stale.js')), false);
    const source = path.join(root, variant === 'source' ? 'src' : 'dist/mp-inspector' + (variant === 'lite' ? '-lite' : ''));
    for (const filename of files(target)) {
      assert.deepEqual(fs.readFileSync(filename), fs.readFileSync(path.join(source, path.relative(target, filename))));
    }
  }
  const app = require('../demo/app.json');
  assert.equal(require('../demo/project.config.json').appid, '');
  for (const reference of Object.values(app.usingComponents)) {
    assert.ok(fs.existsSync(path.join(root, 'demo', reference + '.js')));
  }
});
