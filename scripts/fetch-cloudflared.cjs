'use strict';

// Downloads Cloudflare's tunnel tool when the server runs on Render, so phones can join
// through a trycloudflare.com link even on networks that can't look up onrender.com.
// Elsewhere (your own laptop) it does nothing unless PUBLIC_TUNNEL=on.
const fs = require('node:fs');
const path = require('node:path');

const target = path.join(__dirname, '..', 'bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');

function wanted(env = process.env) {
  if (env.PUBLIC_TUNNEL === 'off') return false;
  return env.PUBLIC_TUNNEL === 'on' || Boolean(env.RENDER);
}

async function fetchCloudflared({ env = process.env } = {}) {
  if (!wanted(env)) return null;
  if (fs.existsSync(target)) return target;
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const file = process.platform === 'win32' ? `cloudflared-windows-${arch}.exe` : process.platform === 'darwin' ? null : `cloudflared-linux-${arch}`;
  if (!file) throw new Error('Install cloudflared yourself on macOS (brew install cloudflared).');
  const response = await fetch(`https://github.com/cloudflare/cloudflared/releases/latest/download/${file}`);
  if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()), { mode: 0o755 });
  return target;
}

module.exports = { fetchCloudflared, wanted, target };

if (require.main === module) {
  fetchCloudflared()
    .then(file => console.log(file ? `cloudflared ready at ${file}` : 'Skipping cloudflared: not running on Render.'))
    // A failed download must not fail the build; the game still works on the Render address.
    .catch(error => console.warn(`Could not download cloudflared: ${error.message}`));
}
