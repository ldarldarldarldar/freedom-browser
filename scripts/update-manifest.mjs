#!/usr/bin/env node
// Signs the update.json that tells installed browsers about a release. Upload it to the release LAST:
// until it is there, nobody is offered the release, so half-uploaded assets are never seen.
//
//   node scripts/update-manifest.mjs keygen
//   node scripts/update-manifest.mjs sign --version 0.6.6 --notes-ru ru.txt --notes-en en.txt \
//        --appimage release/Freedom-Browser-0.6.6-x86_64.AppImage --setup Freedom-Browser-0.6.6-x64-Setup.exe --out update.json
//
// The private key stays outside the repository (default below, or --key). Losing it means every user has to
// install one version by hand, after a new public key has been put in package.json.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = 'ldarldarldarldar/freedom-browser';
const DEFAULT_KEY = path.join(os.homedir(), '.config', 'freedom-browser-signing', 'update-key.pem');

const [command, ...rest] = process.argv.slice(2);
const options = {};
for (let i = 0; i < rest.length; i += 2) {
  if (!rest[i].startsWith('--') || rest[i + 1] === undefined) throw new Error(`Bad argument: ${rest[i]}`);
  options[rest[i].slice(2)] = rest[i + 1];
}
const keyPath = options.key ?? DEFAULT_KEY;

const publicKeyBase64 = (key) => crypto.createPublicKey(key).export({ type: 'spki', format: 'der' }).toString('base64');

function keygen() {
  if (fs.existsSync(keyPath)) throw new Error(`${keyPath} already exists, refusing to replace the signing key`);
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.mkdirSync(path.dirname(keyPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  console.log(`Private key: ${keyPath}`);
  console.log(`Public key for package.json: ${publicKeyBase64(privateKey)}`);
}

function describeFile(filePath, baseUrl) {
  const data = fs.readFileSync(filePath);
  return {
    url: `${baseUrl}/${encodeURIComponent(path.basename(filePath))}`,
    sha256: crypto.createHash('sha256').update(data).digest('hex'),
    size: data.length,
  };
}

function sign() {
  const { version, out } = options;
  if (!version || !out) throw new Error('--version and --out are required');
  const baseUrl = options['base-url'] ?? `https://github.com/${REPO}/releases/download/v${version}`;
  const files = {};
  if (options.appimage) files.appimage = describeFile(options.appimage, baseUrl);
  if (options.setup) files.nsis = describeFile(options.setup, baseUrl);
  const manifest = JSON.stringify({
    version,
    releaseUrl: options['release-url'] ?? `https://github.com/${REPO}/releases/tag/v${version}`,
    notes: {
      ru: options['notes-ru'] ? fs.readFileSync(options['notes-ru'], 'utf8').trim() : '',
      en: options['notes-en'] ? fs.readFileSync(options['notes-en'], 'utf8').trim() : '',
    },
    files,
  });
  const key = crypto.createPrivateKey(fs.readFileSync(keyPath));
  const signature = crypto.sign(null, Buffer.from(manifest, 'utf8'), key).toString('base64');
  fs.writeFileSync(out, JSON.stringify({ manifest, signature }, null, 2));
  console.log(`${out}: version ${version}, files: ${Object.keys(files).join(', ') || 'none'}`);
  console.log(`Signed by public key: ${publicKeyBase64(key)}`);
}

if (command === 'keygen') keygen();
else if (command === 'sign') sign();
else throw new Error('Usage: update-manifest.mjs keygen | sign --version X --out update.json [...]');
