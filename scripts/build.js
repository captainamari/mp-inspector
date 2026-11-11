const fs = require('node:fs');
const path = require('node:path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
const { files } = require('./files');
const pkg = require('../package.json');
const version = require('../src/core/version');

async function build(variant) {
  if (!['full', 'lite'].includes(variant)) throw new Error('Expected full or lite');
  const name = variant === 'full' ? 'mp-inspector' : 'mp-inspector-lite';
  const directory = path.join('dist', name);
  fs.rmSync(directory, { recursive: true, force: true });
  for (const filename of files('src')) {
    const relative = path.relative('src', filename);
    let content = fs.readFileSync(filename, 'utf8');
    if (variant === 'lite' && relative === path.join('core', 'remote-logger.js')) {
      content = 'module.exports={supported:false,install:function(){},uninstall:function(){},flush:function(){}};';
    }
    if (filename.endsWith('.js')) {
      const result = await minify(content, {
        compress: { drop_console: false, passes: 2 },
        mangle: { toplevel: true },
        format: { comments: false }
      });
      content = result.code;
    } else if (filename.endsWith('.wxss')) {
      const result = new CleanCSS({ level: 1 }).minify(content);
      if (result.errors.length) throw new Error(result.errors.join('\n'));
      content = result.styles;
    } else if (filename.endsWith('.json')) {
      content = JSON.stringify(JSON.parse(content));
    }
    // Preserve WXML/WXS whitespace: blanket HTML minification can change displayed text.
    const output = path.join(directory, relative);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, content);
  }
  const sdkBytes = files(directory).reduce((total, file) => total + fs.statSync(file).size, 0);
  for (const file of ['README.md', 'LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md']) fs.copyFileSync(file, path.join(directory, file));
  fs.cpSync('docs', path.join(directory, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({
    name, version, private: true, description: pkg.description, main: 'core/index.js',
    license: pkg.license, author: pkg.author, repository: pkg.repository
  }, null, 2) + '\n');
  console.log(variant + ': ' + sdkBytes + ' SDK bytes (uncompressed on disk, excludes documentation)');
  return { variant, version, sdkBytes };
}

(async () => {
  if (version !== pkg.version) throw new Error('package.json and src/core/version.js disagree');
  const variants = process.argv[2] ? [process.argv[2]] : ['full', 'lite'];
  const report = [];
  for (const variant of variants) report.push(await build(variant));
  fs.writeFileSync('dist/build-report.json', JSON.stringify(report, null, 2) + '\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
