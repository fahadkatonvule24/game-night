const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createRooms, GameError } = require('./tablegames.cjs');
const { fetchCloudflared, wanted: tunnelWanted } = require('./scripts/fetch-cloudflared.cjs');

const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
// Development folders stay private even though the server is reachable on the local network.
const hidden = new Set(['node_modules', 'tests', 'scripts', 'bin']);

// Addresses phones on the same Wi-Fi can use to reach this laptop. Private ranges come first.
function lanAddresses() {
  const all = Object.values(os.networkInterfaces()).flat().filter(item => item && item.family === 'IPv4' && !item.internal).map(item => item.address);
  const rank = address => (address.startsWith('192.168.') ? 0 : address.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(address) ? 2 : 3);
  return all.sort((a, b) => rank(a) - rank(b));
}

// Pulls the public link out of cloudflared's log, e.g. https://happy-cat-words.trycloudflare.com.
// The api. host is Cloudflare's own endpoint, not a link for players.
function tunnelUrlFrom(text) {
  return String(text).match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/)?.[0] || null;
}

// A free Cloudflare "quick tunnel" gives phones a trycloudflare.com link to this server. It restarts
// if it drops (the link changes, and the big screen always shows the current one).
function startTunnel(port, tunnel, binary) {
  tunnel.status = 'starting';
  const child = spawn(binary, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  const watch = chunk => {
    const found = tunnelUrlFrom(chunk);
    if (!found || found === tunnel.url) return;
    tunnel.url = found;
    tunnel.status = 'ready';
    console.log(`Phones can join from any network: ${found}`);
  };
  child.stdout.on('data', watch);
  child.stderr.on('data', watch);
  child.on('error', error => console.warn(`Tunnel failed to start: ${error.message}`));
  child.on('exit', () => {
    tunnel.url = null;
    tunnel.status = 'starting';
    setTimeout(() => startTunnel(port, tunnel, binary), 5000).unref();
  });
  return child;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size <= 8192) chunks.push(chunk);
    });
    request.on('end', () => {
      if (size > 8192) { reject(new GameError('That request is too large.')); return; }
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new GameError('That request wasn’t valid.')); }
    });
    request.on('error', reject);
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

function createServer({ port = 3000, rooms = createRooms(), tunnel = { status: 'off', url: null } } = {}) {
  async function api(request, response, url) {
    const parts = url.pathname.split('/').filter(Boolean).slice(1);
    if (request.method === 'GET' && parts[0] === 'network') {
      const actualPort = server.address()?.port || port;
      sendJson(response, 200, { urls: lanAddresses().map(address => `http://${address}:${actualPort}`), tunnel: tunnel.status, publicUrl: tunnel.url });
      return;
    }
    if (parts[0] !== 'rooms') { sendJson(response, 404, { error: 'Not found' }); return; }
    if (request.method === 'POST' && parts.length === 1) {
      const body = await readJson(request);
      sendJson(response, 200, rooms.create(body.game, body.options));
      return;
    }
    const code = parts[1];
    if (request.method === 'GET' && parts[2] === 'events') {
      const query = url.searchParams;
      // no-transform and X-Accel-Buffering stop hosting proxies (Render, Cloudflare) from compressing or holding back live updates.
      response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' });
      const ping = setInterval(() => response.write(': ping\n\n'), 20000);
      let unsubscribe = () => {};
      const finish = () => { clearInterval(ping); unsubscribe(); };
      request.on('close', finish);
      try {
        unsubscribe = rooms.subscribe(code, { playerId: query.get('player'), key: query.get('key'), hostKey: query.get('host') }, {
          send: view => response.write(`data: ${JSON.stringify(view)}\n\n`),
          end: () => { response.write('event: closed\ndata: {}\n\n'); response.end(); }
        });
      } catch (error) {
        response.write(`event: problem\ndata: ${JSON.stringify({ error: error instanceof GameError ? error.message : 'Something went wrong.' })}\n\n`);
        response.end();
        finish();
      }
      return;
    }
    if (request.method === 'GET' && parts[2] === 'poll') {
      const query = url.searchParams;
      const { promise, cancel } = rooms.poll(code, { playerId: query.get('player'), key: query.get('key'), hostKey: query.get('host') }, query.get('since'));
      response.on('close', () => { if (!response.writableEnded) cancel(); });
      const value = await promise;
      if (!response.writableEnded && !response.destroyed) sendJson(response, 200, value);
      return;
    }
    if (request.method !== 'POST') { sendJson(response, 405, { error: 'Not allowed' }); return; }
    const body = await readJson(request);
    if (parts[2] === 'join') sendJson(response, 200, rooms.join(code, body));
    else if (parts[2] === 'start') { rooms.start(code, body.hostKey); sendJson(response, 200, { ok: true }); }
    else if (parts[2] === 'action') { rooms.act(code, body); sendJson(response, 200, { ok: true }); }
    else if (parts[2] === 'remove') { rooms.remove(code, body.hostKey, body.playerId); sendJson(response, 200, { ok: true }); }
    else if (parts[2] === 'close') { rooms.close(code, body.hostKey); sendJson(response, 200, { ok: true }); }
    else sendJson(response, 404, { error: 'Not found' });
  }

  const server = http.createServer((request, response) => {
    let url;
    try { url = new URL(request.url, 'http://localhost'); decodeURIComponent(url.pathname); }
    catch { response.writeHead(400).end('Bad request'); return; }
    if (url.pathname.startsWith('/api/')) {
      api(request, response, url).catch(error => {
        if (response.headersSent) { response.end(); return; }
        sendJson(response, error instanceof GameError ? 400 : 500, { error: error instanceof GameError ? error.message : 'Something went wrong.' });
      });
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const alias = { '/': '/index.html', '/play': '/play.html' };
    const file = path.resolve(root, '.' + (alias[pathname] || pathname));
    const relative = path.relative(root, file);
    const segments = relative.split(path.sep);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !types[path.extname(file)] || segments.some(part => part.startsWith('.')) || hidden.has(segments[0])) {
      response.writeHead(404).end('Not found'); return;
    }
    fs.readFile(file, (error, contents) => {
      if (error) { response.writeHead(404).end('Not found'); return; }
      response.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      if (request.method === 'HEAD') response.end(); else response.end(contents);
    });
  });
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  // Listen on every network card so phones on the same Wi-Fi can join phone games.
  const host = process.env.HOST || '0.0.0.0';
  const tunnel = { status: tunnelWanted() ? 'starting' : 'off', url: null };
  createServer({ port, tunnel }).listen(port, host, () => {
    console.log(`Game Night is ready: http://localhost:${port}`);
    lanAddresses().forEach(address => console.log(`On your Wi-Fi:       http://${address}:${port}`));
    if (tunnel.status === 'off') return;
    fetchCloudflared()
      .then(binary => startTunnel(port, tunnel, binary))
      .catch(error => { tunnel.status = 'off'; console.warn(`No public tunnel: ${error.message}`); });
  });
}

module.exports = { createServer, lanAddresses, tunnelUrlFrom };
