'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jsQR = require('jsqr');
const { createServer, tunnelUrlFrom } = require('../server.cjs');
const { wanted } = require('../scripts/fetch-cloudflared.cjs');
const qr = require('../qr.js');

// Reads Server-Sent Events from the table until `until` returns true.
function watch(base, path, until) {
  return new Promise((resolve, reject) => {
    const views = [];
    const request = http.get(base + path, response => {
      let buffer = '';
      response.on('data', chunk => {
        buffer += chunk;
        let index;
        while ((index = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          const data = block.split('\n').find(line => line.startsWith('data: '));
          if (data) views.push(JSON.parse(data.slice(6)));
          if (block.startsWith('event: problem')) { request.destroy(); resolve({ problem: true, views }); return; }
          if (views.length && until(views[views.length - 1], views)) { request.destroy(); resolve({ views }); return; }
        }
      });
    });
    request.on('error', error => { if (error.code !== 'ECONNRESET') reject(error); });
  });
}

test('the server opens a table, seats phones, streams private views and plays moves', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body) => {
    const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };

  const network = await (await fetch(`${base}/api/network`)).json();
  assert.ok(Array.isArray(network.urls));
  const room = (await post('/api/rooms', { game: 'matatu' })).body;
  assert.match(room.code, /^[A-Z]{4}$/);
  const amina = (await post(`/api/rooms/${room.code}/join`, { name: 'Amina', emoji: '🦊' })).body;
  const brian = (await post(`/api/rooms/${room.code}/join`, { name: 'Brian' })).body;
  assert.equal((await post(`/api/rooms/${room.code}/start`, { hostKey: 'nope' })).status, 400);

  const hostWatch = watch(base, `/api/rooms/${room.code}/events?host=${room.hostKey}`, view => view.started);
  const phoneWatch = watch(base, `/api/rooms/${room.code}/events?player=${amina.playerId}&key=${amina.key}`, view => view.started);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal((await post(`/api/rooms/${room.code}/start`, { hostKey: room.hostKey })).body.ok, true);
  const [hostViews, phoneViews] = await Promise.all([hostWatch, phoneWatch]);
  const hostView = hostViews.views.at(-1);
  const phoneView = phoneViews.views.at(-1);
  assert.equal(hostView.game.you, null, 'the big screen never sees a hand');
  assert.equal(phoneView.game.you.hand.length, 7);
  assert.equal(phoneView.you.name, 'Amina');

  const wrongTurn = await post(`/api/rooms/${room.code}/action`, { playerId: brian.playerId, key: brian.key, action: { type: 'pick' } });
  assert.equal(wrongTurn.status, 400);
  assert.match(wrongTurn.body.error, /Amina’s turn/);
  assert.equal((await post(`/api/rooms/${room.code}/action`, { playerId: amina.playerId, key: brian.key, action: { type: 'pick' } })).status, 400);
  assert.equal((await post(`/api/rooms/${room.code}/action`, { playerId: amina.playerId, key: amina.key, action: { type: 'pick' } })).body.ok, true);
  const after = await watch(base, `/api/rooms/${room.code}/events?player=${amina.playerId}&key=${amina.key}`, () => true);
  assert.equal(after.views[0].game.you.hand.length, 8);

  const stranger = await watch(base, `/api/rooms/${room.code}/events?player=${amina.playerId}&key=bad`, () => true);
  assert.equal(stranger.problem, true);
  assert.equal((await post('/api/rooms', { game: 'chess' })).status, 400);
  const big = await fetch(`${base}/api/rooms`, { method: 'POST', body: 'x'.repeat(9000) });
  assert.equal(big.status, 400);
});

test('the server serves the app and the phone page but keeps dev folders private', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.match(await (await fetch(`${base}/play`)).text(), /Join the table/);
  for (const path of ['/node_modules/jsqr/package.json', '/node_modules/jsqr/dist/jsQR.js', '/tests/server.test.cjs', '/server.cjs', '/../package.json', '/.git/config']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
});

test('the QR encoder makes codes that a real decoder can read', () => {
  const read = text => {
    const { size, modules } = qr.encode(text);
    const scale = 4;
    const quiet = 4;
    const full = (size + quiet * 2) * scale;
    const data = new Uint8ClampedArray(full * full * 4);
    for (let y = 0; y < full; y += 1) for (let x = 0; x < full; x += 1) {
      const mx = Math.floor(x / scale) - quiet;
      const my = Math.floor(y / scale) - quiet;
      const dark = mx >= 0 && my >= 0 && mx < size && my < size && modules[my][mx];
      data.fill(dark ? 0 : 255, (y * full + x) * 4, (y * full + x) * 4 + 3);
      data[(y * full + x) * 4 + 3] = 255;
    }
    return jsQR(data, full, full)?.data;
  };
  for (const text of ['http://192.168.1.23:3000/play.html?room=ABCD', 'http://10.0.0.5:3000/play.html?room=WXYZ', 'Kampala 🇺🇬', 'z'.repeat(150)]) assert.equal(read(text), text);
  assert.throws(() => qr.encode('x'.repeat(400)), /too long/);
  assert.match(qr.toSvg('hi'), /^<svg[^>]+viewBox="0 0 29 29"/);
});

test('the public tunnel link is read from cloudflared and shared with the big screen', async t => {
  assert.equal(tunnelUrlFrom('INF |  https://warm-lion-river-blue.trycloudflare.com  |'), 'https://warm-lion-river-blue.trycloudflare.com');
  assert.equal(tunnelUrlFrom('ERR failed: Post "https://api.trycloudflare.com/tunnel"'), null, 'Cloudflare’s own API address is not a player link');
  assert.equal(tunnelUrlFrom('nothing here'), null);
  assert.equal(wanted({ RENDER: 'true' }), true);
  assert.equal(wanted({ RENDER: 'true', PUBLIC_TUNNEL: 'off' }), false);
  assert.equal(wanted({}), false, 'a laptop server stays local unless asked');
  assert.equal(wanted({ PUBLIC_TUNNEL: 'on' }), true);
  const tunnel = { status: 'ready', url: 'https://warm-lion-river-blue.trycloudflare.com' };
  const server = createServer({ tunnel });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const network = await (await fetch(`http://127.0.0.1:${server.address().port}/api/network`)).json();
  assert.equal(network.tunnel, 'ready');
  assert.equal(network.publicUrl, tunnel.url);
  for (const path of ['/scripts/fetch-cloudflared.cjs', '/bin/cloudflared']) assert.equal((await fetch(`http://127.0.0.1:${server.address().port}${path}`)).status, 404, path);
});

test('long-polling answers at once when behind, waits for the next change, and keeps seats private', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body) => (await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  const room = await post('/api/rooms', { game: 'rps' });
  const amina = await post(`/api/rooms/${room.code}/join`, { name: 'Amina' });
  const first = await (await fetch(`${base}/api/rooms/${room.code}/poll?player=${amina.playerId}&key=${amina.key}&since=-1`)).json();
  assert.equal(first.you.name, 'Amina');
  const started = Date.now();
  const waiting = fetch(`${base}/api/rooms/${room.code}/poll?player=${amina.playerId}&key=${amina.key}&since=${first.version}`).then(r => r.json());
  await new Promise(resolve => setTimeout(resolve, 150));
  await post(`/api/rooms/${room.code}/join`, { name: 'Brian' });
  const next = await waiting;
  assert.ok(Date.now() - started < 2000, 'the change arrives straight away');
  assert.deepEqual(next.players.map(p => p.name), ['Amina', 'Brian']);
  assert.equal((await fetch(`${base}/api/rooms/${room.code}/poll?player=${amina.playerId}&key=wrong&since=-1`)).status, 400);
  const closing = fetch(`${base}/api/rooms/${room.code}/poll?host=${room.hostKey}&since=${next.version}`).then(r => r.json());
  await new Promise(resolve => setTimeout(resolve, 100));
  await post(`/api/rooms/${room.code}/close`, { hostKey: room.hostKey });
  assert.deepEqual(await closing, { closed: true });
});
