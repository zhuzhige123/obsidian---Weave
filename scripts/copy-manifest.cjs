// Minimal manifest/versions copy after build
const fs = require('fs');
const path = require('path');

const outdir = process.env.OUTDIR || 'dist';

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const text = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
  return JSON.parse(text);
}

// 读取根目录的 manifest.json
const manifestPath = path.resolve(__dirname, '..', 'manifest.json');
const manifest = readJson(manifestPath);

// 读取 public/versions.json
const versionsPath = path.resolve(__dirname, '..', 'public', 'versions.json');
let versions = {};
try {
  if (fs.existsSync(versionsPath)) {
    versions = readJson(versionsPath);
  }
} catch (e) {
  console.warn(`⚠️  Warning: Failed to read versions.json, will recreate. ${e?.message || e}`);
  versions = {};
}

// 验证当前版本是否在 versions.json 中
const currentVersion = manifest.version;
const minAppVersion = manifest.minAppVersion;
if (!versions[currentVersion] || (minAppVersion && versions[currentVersion] !== minAppVersion)) {
  versions[currentVersion] = minAppVersion;
  console.log(`✅ Updated versions.json for current version ${currentVersion}`);
  if (process.env.NO_UPDATE_PUBLIC_VERSIONS !== '1') {
    fs.mkdirSync(path.dirname(versionsPath), { recursive: true });
    fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2));
  }
} else {
  console.log(`✅ Current version ${currentVersion} found in versions.json`);
}

fs.mkdirSync(outdir, { recursive: true });
fs.writeFileSync(path.join(outdir, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(outdir, 'versions.json'), JSON.stringify(versions, null, 2));

console.log(`✅ Copied manifest.json to ${outdir}`);
console.log(`✅ Copied versions.json to ${outdir}`);
// css emitted by Vite is styles.css per config
