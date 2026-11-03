(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GameNightPhones = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  // The big-screen side of a phone game: opens a table, shows the join QR code, then the live table.
  const THROWS = { rock: '✊', paper: '✋', scissors: '✌️' };
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const red = card => card.suit === '♥' || card.suit === '♦';
  const cardFace = (card, extra = '') => `<span class="pcard ${red(card) ? 'red' : ''} ${extra}"><span class="corner">${escape(card.rank)}<br>${card.suit}</span><span class="pip">${card.suit}</span></span>`;
  const marquee = `<div class="tv-marquee" aria-hidden="true">${'<i></i>'.repeat(22)}</div>`;

  function create(options) {
    const { container, gameId } = options;
    const host = container.ownerDocument.defaultView;
    const banter = options.banter || { line: () => '', emojis: () => [] };
    let destroyed = false;
    let room = null;
    let joinUrl = '';
    let lanFound = false;
    let anyNetwork = false;
    let view = null;
    let source = null;
    const feed = [];
    const seen = { events: -1, rounds: 0, seq: -1, winner: null, version: 0 };

    const emit = (name, ...args) => { if (!destroyed) { try { options[name]?.(...args); } catch { /* Optional extras never stop the table. */ } } };
    const say = (kind, vars) => {
      const text = banter.line(kind, vars);
      if (text) feed.unshift({ text, kind });
      feed.length = Math.min(feed.length, 5);
      banter.emojis(kind).slice(0, 2).forEach(emoji => emit('react', emoji));
    };
    async function call(path, body, method = 'POST') {
      const response = await host.fetch(path, method === 'GET' ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), keepalive: path.endsWith('/close') });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Something went wrong.');
      return data;
    }
    function show(markup) { if (!destroyed) container.innerHTML = `<section class="tv-show ph-table" data-phone="${gameId}">${marquee}${markup}</section>`; }
    function problem(title, text) {
      show(`<div class="tv-card"><div class="tv-emote" aria-hidden="true">🔌</div><h2 id="dialog-title" class="tv-title tv-title-small">${escape(title)}</h2><p class="tv-lede">${text}</p><div class="dialog-actions"><button type="button" class="button tv-button" data-phone-action="close">Back to the games</button></div></div>`);
    }

    async function open() {
      if (host.location.protocol === 'file:') {
        problem('Phone games need the laptop server.', 'Open a terminal in the Game Night folder, run <code>npm start</code>, then open <b>http://localhost:3000</b> on this laptop.');
        return;
      }
      show('<div class="tv-card"><div class="spinner-big" aria-hidden="true"></div><h2 id="dialog-title" class="tv-title tv-title-small">Setting the table…</h2><p class="tv-lede" data-wake></p></div>');
      // Free hosting plans sleep when idle; say so instead of spinning in silence.
      const wake = host.setTimeout(() => { const note = container.querySelector('[data-wake]'); if (note && !view) note.textContent = 'Waking up the server. On a free hosting plan this can take up to a minute…'; }, 4000);
      try {
        room = await call('/api/rooms', { game: gameId, options: options.roomOptions || {} });
        const ask = () => call('/api/network', null, 'GET').catch(() => ({ urls: [] }));
        let network = await ask();
        // The public tunnel takes a few seconds to come up after the server wakes; wait for its link.
        for (let i = 0; network.tunnel === 'starting' && !network.publicUrl && i < 12 && !destroyed; i += 1) {
          await new Promise(resolve => host.setTimeout(resolve, 1500));
          network = await ask();
        }
        const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host.location.hostname);
        lanFound = !local || network.urls.length > 0 || Boolean(network.publicUrl);
        anyNetwork = Boolean(network.publicUrl) || !local;
        // Phones join through the public tunnel when there is one: it works on networks that can't reach the host's own address.
        const base = network.publicUrl || (local && network.urls.length ? network.urls[0] : host.location.origin);
        joinUrl = `${base}/play.html?room=${room.code}`;
      } catch {
        problem('Couldn’t open a table.', 'Make sure the laptop server is running with <code>npm start</code>, then try again.');
        return;
      }
      if (destroyed) { call(`/api/rooms/${room.code}/close`, { hostKey: room.hostKey }).catch(() => {}); return; }
      source = new host.EventSource(`/api/rooms/${room.code}/events?host=${encodeURIComponent(room.hostKey)}`);
      source.onmessage = event => { host.clearTimeout(wake); view = JSON.parse(event.data); react(); render(); };
      source.addEventListener('closed', () => { source.close(); });
    }

    // Turns fresh moves into commentary, sounds and floating emojis.
    function react() {
      const g = view.game;
      if (!g) { seen.events = -1; seen.rounds = 0; seen.seq = -1; seen.winner = null; seen.key = undefined; return; }
      if (PARTY.includes(gameId)) { reactParty(g); return; }
      const name = id => view.players.find(p => p.id === id)?.name || 'Someone';
      if (gameId === 'matatu') {
        // A rematch restarts the move counter, so start the commentary over.
        if (g.events[g.events.length - 1].seq < seen.events) seen.events = -1;
        const fresh = g.events.filter(e => e.seq > seen.events);
        if (seen.events === -1) { seen.events = g.events[g.events.length - 1].seq; feed.length = 0; say('card-play', { name: 'The dealer', card: `${g.top.rank}${g.top.suit}` }); emit('onSound', 'shuffle'); return; }
        fresh.forEach(e => {
          const vars = { name: name(e.playerId), card: e.card ? `${e.card.rank}${e.card.suit}` : '', suit: e.suit || '', count: e.count, other: name(e.targetId) };
          if (e.type === 'play' && e.power === 'ace') { say('card-ace', vars); emit('onSound', 'streak'); }
          else if (e.type === 'play' && !e.power) { say('card-play', vars); emit('onSound', 'correct'); }
          else if (e.type === 'play') emit('onSound', 'correct');
          else if (e.type === 'two') { say('card-two', vars); emit('onSound', 'wrong'); }
          else if (e.type === 'skip') { say('card-skip', vars); emit('onSound', 'skip'); }
          else if (e.type === 'penalty') { say('card-penalty', vars); emit('onSound', 'buzzer'); }
          else if (e.type === 'cut') { say('card-cut', vars); emit('onSound', 'champion'); emit('onCelebrate', 200); }
          else if (e.type === 'pick') { say('card-pick', vars); emit('onSound', 'skip'); }
          else if (e.type === 'pass') { say('card-pass', vars); emit('onSound', 'reveal'); }
          else if (e.type === 'last-card') { say('card-last', vars); emit('onSound', 'tick'); }
          else if (e.type === 'reshuffle') { say('card-reshuffle', vars); emit('onSound', 'shuffle'); }
          else if (e.type === 'win') { say('card-win', vars); emit('onSound', 'champion'); emit('onCelebrate', 200); }
        });
        if (fresh.length) seen.events = fresh[fresh.length - 1].seq;
      } else if (gameId === 'rps') {
        if (g.round - 1 > seen.rounds && g.last) {
          say(g.last.winnerId ? 'rps-round' : 'rps-tie', { name: name(g.last.winnerId) });
          emit('onSound', g.last.winnerId ? 'correct' : 'reveal');
        }
        if (g.round - 1 < seen.rounds) feed.length = 0;
        seen.rounds = g.round - 1;
        if (g.winnerId && seen.winner !== g.winnerId) { say('rps-win', { name: name(g.winnerId) }); emit('onSound', 'champion'); emit('onCelebrate', 200); }
        seen.winner = g.winnerId;
      } else {
        if (g.seq > seen.seq && seen.seq >= 0) emit('onSound', 'tick');
        if (g.seq < seen.seq) feed.length = 0;
        seen.seq = g.seq;
        const ending = g.winnerId || (g.draw ? 'draw' : null);
        if (ending && seen.winner !== ending) {
          if (g.winnerId) { say('four-win', { name: name(g.winnerId) }); emit('onSound', 'champion'); emit('onCelebrate', 200); }
          else { say('four-draw', {}); emit('onSound', 'finish'); }
        }
        seen.winner = ending;
      }
    }

    function lobby() {
      const needed = Math.max(0, view.min - view.players.length);
      const qr = root.GameNightQR ? root.GameNightQR.toSvg(joinUrl) : '';
      return `<div class="ph-lobby"><div class="ph-qr">${qr}</div><div class="ph-join"><span class="tv-kicker">${escape(view.title.toUpperCase())} · SCAN TO JOIN</span><h2 id="dialog-title" class="tv-title tv-title-small">Grab your phones!</h2><p class="tv-lede">Scan the code with your phone camera, or open <b class="ph-url">${escape(joinUrl)}</b> and enter</p><div class="ph-code" aria-label="Table code ${escape(view.code)}">${escape(view.code).split('').map(letter => `<span>${letter}</span>`).join('')}</div>${lanFound ? '' : '<p class="tv-note">⚠️ This laptop isn’t on a network. Connect it to Wi-Fi so phones can reach it.</p>'}<p class="tv-note">${anyNetwork ? 'Works on any Wi-Fi or mobile data.' : 'Phones must be on the same Wi-Fi as this laptop.'}</p></div></div>
        <h3 class="tv-seat-heading">At the table · ${view.players.length} of ${view.max}</h3>
        <div class="tv-seats ph-players">${view.players.length ? view.players.map((p, i) => `<span class="tv-seat is-up" style="--i:${i}"><span class="tv-avatar" aria-hidden="true">${escape(p.emoji)}</span>${escape(p.name)}<button type="button" class="ph-remove" data-phone-remove="${escape(p.id)}" aria-label="Remove ${escape(p.name)}">×</button></span>`).join('') : '<p class="tv-note">Nobody yet. Be the first to scan! 👀</p>'}</div>
        <div class="dialog-actions">${secondary('close', 'Close table')}<button type="button" class="button tv-button" data-phone-action="start" ${needed ? 'disabled' : ''}>${needed ? `Waiting for ${needed} more…` : `Deal everyone in · ${view.players.length} players`} <span aria-hidden="true">↗</span></button></div>`;
    }
    const secondary = (action, label) => `<button type="button" class="button tv-button-ghost" data-phone-action="${action}">${escape(label)}</button>`;
    const feedMarkup = () => `<ol class="ph-feed" aria-live="polite">${feed.map((item, i) => `<li class="${i === 0 ? 'is-new' : ''}">${escape(item.text)}</li>`).join('')}</ol>`;

    // What each card does, always on show so nobody has to remember.
    const guide = g => `<ul class="ph-guide" aria-label="What each card does"><li><b>2</b> next picks 2</li><li><b>8 · J</b> skip next</li><li><b>A</b> choose the suit</li><li class="is-cut"><b class="${red({ suit: g.cutSuit }) ? 'red' : ''}">7${g.cutSuit}</b> ✂️ cuts the game</li></ul>`;
    function matatuTable(g) {
      const turn = view.players.find(p => p.id === g.turnId);
      const kicker = `<span class="tv-kicker">MATATU · TABLE ${escape(view.code)}</span>`;
      if (g.winnerIds) {
        const winners = g.winnerIds.map(id => view.players.find(p => p.id === id));
        const cutter = g.cutterId && view.players.find(p => p.id === g.cutterId);
        const heading = g.ending === 'empty' ? `${winners[0].emoji} ${winners[0].name} played every card and wins!` : `✂️ ${cutter.name} cut the game! ${winners.map(w => w.name).join(' & ')} ${winners.length > 1 ? 'win' : 'wins'}!`;
        const ranked = [...g.players].sort((a, b) => g.scores[a.id] - g.scores[b.id]);
        return `${kicker}<div class="tv-trophy" aria-hidden="true">${g.ending === 'cut' ? '✂️' : '🏆'}</div><h2 id="dialog-title" class="tv-title tv-title-small">${escape(heading)}</h2><p class="tv-lede">${g.ending === 'cut' ? 'Lowest points in hand wins.' : 'An empty hand beats everything.'} A = 15, 2 = 20, J = 11, Q = 12, K = 13, others face value.</p>
          <ol class="ph-scores">${ranked.map((p, i) => `<li class="${g.winnerIds.includes(p.id) ? 'is-winner' : ''}" style="--i:${i}"><span class="ph-face">${escape(p.emoji)}</span><b>${escape(p.name)}</b><span class="ph-mini-hand">${p.hand.map(card => `<i class="${red(card) ? 'red' : ''}">${escape(card.rank)}${card.suit}</i>`).join('') || '—'}</span><strong>${g.scores[p.id]} pts</strong></li>`).join('')}</ol>${feedMarkup()}`;
      }
      const backs = Math.min(4, Math.ceil(g.deckCount / 10));
      return `${kicker}<h2 id="dialog-title" class="tv-title tv-title-small">${escape(`${turn.emoji} ${turn.name}’s turn`)}</h2>
        ${g.pending ? `<p class="ph-pending" role="status">⚠️ ${escape(turn.name)}: answer with a 2, or pick ${g.pending}!</p>` : ''}
        <div class="ph-felt"><div class="ph-pile"><div class="ph-stack">${Array.from({ length: Math.max(1, backs) }, (_, i) => `<span class="pcard back" style="--i:${i}"></span>`).join('')}</div><small>${g.deckCount} to pick</small></div>
        <div class="ph-pile">${cardFace(g.top, 'ph-top')}<small>Follow <b class="${red({ suit: g.suit }) ? 'red' : ''}">${g.suit}</b> or ${escape(g.top.rank)}</small></div>
        <div class="ph-pile ph-cut">${cardFace(g.cutCard, 'ph-cut-card')}<small>Cutting card · <b class="${red({ suit: g.cutSuit }) ? 'red' : ''}">7${g.cutSuit}</b> cuts</small></div></div>
        ${guide(g)}
        <ol class="ph-seats">${g.players.map(p => `<li class="${p.id === g.turnId ? 'is-turn' : ''}"><span class="ph-face">${escape(p.emoji)}</span><b>${escape(p.name)}</b><span class="ph-fan" aria-label="${p.cards} cards">${Array.from({ length: Math.min(p.cards, 9) }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</span><small>${p.cards === 1 ? '⚠️ 1 card!' : `${p.cards} cards`}</small></li>`).join('')}</ol>
        ${feedMarkup()}`;
    }
    function duel(g) {
      const [a, b] = g.players;
      const pips = p => Array.from({ length: g.target }, (_, i) => `<i class="${i < p.score ? 'on' : ''}"></i>`).join('');
      const status = p => (g.winnerId ? (p.id === g.winnerId ? '🏆 Champion' : '😵 Defeated') : p.thrown ? '🤫 Locked in' : '🤔 Thinking…');
      const last = g.last;
      const reveal = last ? `<div class="ph-reveal" data-round="${g.round}"><span class="ph-throw ${last.winnerId === a.id ? 'won' : ''}">${THROWS[last.picks[a.id]]}</span><span class="ph-vs">VS</span><span class="ph-throw flip ${last.winnerId === b.id ? 'won' : ''}">${THROWS[last.picks[b.id]]}</span></div>` : '<div class="ph-reveal"><span class="ph-vs">Round 1 · throw on your phones!</span></div>';
      return `<span class="tv-kicker">ROCK PAPER SCISSORS · FIRST TO ${g.target}</span><h2 id="dialog-title" class="tv-title tv-title-small">${g.winnerId ? `${escape(view.players.find(p => p.id === g.winnerId).name)} wins the duel!` : `Round ${g.round}`}</h2>
        <div class="ph-duel">${[a, b].map(p => `<div class="ph-duelist ${p.thrown && !g.winnerId ? 'is-ready' : ''}"><span class="ph-face big">${escape(p.emoji)}</span><b>${escape(p.name)}</b><span class="ph-pips">${pips(p)}</span><small>${status(p)}</small></div>`).join('')}</div>${reveal}${feedMarkup()}`;
    }
    function four(g) {
      const turn = g.players.find(p => p.id === g.turnId);
      const winning = new Set((g.line || []).map(([r, c]) => `${r}-${c}`));
      const heading = g.winnerId ? `${g.players.find(p => p.id === g.winnerId).name} connects four!` : g.draw ? 'A draw!' : `${turn.emoji} ${turn.name}’s move`;
      return `<span class="tv-kicker">FOUR IN A ROW · TABLE ${escape(view.code)}</span><h2 id="dialog-title" class="tv-title tv-title-small">${escape(heading)}</h2>
        <div class="ph-four-players">${g.players.map((p, i) => `<span class="${p.id === g.turnId && !g.winnerId && !g.draw ? 'is-turn' : ''}"><i class="ph-disc disc-${i}"></i>${escape(p.emoji)} ${escape(p.name)}</span>`).join('<b>vs</b>')}</div>
        <div class="ph-board">${g.board.map((row, r) => row.map((cell, c) => `<span class="ph-slot">${cell === null ? '' : `<i class="ph-disc disc-${cell} ${g.last && g.last.row === r && g.last.column === c ? 'drop' : ''} ${winning.has(`${r}-${c}`) ? 'win' : ''}" style="--r:${r}"></i>`}</span>`).join('')).join('')}</div>${feedMarkup()}`;
    }

    // --- Party games run from the big screen ---------------------------------------------
    const PARTY = ['imposter', 'pass-bomb', 'most-likely', 'would-you-rather'];
    const person = id => view.players.find(p => p.id === id) || { name: 'Someone', emoji: '🙂' };
    const who = p => `${escape(p.emoji)} ${escape(p.name)}`;
    const hostButton = (action, label, primary = true, disabled = false) => `<button type="button" class="button ${primary ? 'tv-button' : 'tv-button-ghost'}" data-phone-host="${action}" ${disabled ? 'disabled' : ''}>${escape(label)}</button>`;
    const checklist = (players, flag) => `<div class="tv-seats ph-players">${players.map((p, i) => `<span class="tv-seat ${p[flag] ? 'is-up' : ''}" style="--i:${i}"><span class="tv-avatar" aria-hidden="true">${escape(p.emoji)}</span>${escape(p.name)}${p[flag] ? ' ✓' : ''}</span>`).join('')}</div>`;
    function voteBars(counts) {
      const rows = view.players.map(p => ({ p, n: counts[p.id] || 0 })).filter(r => r.n).sort((a, b) => b.n - a.n);
      const top = Math.max(1, ...rows.map(r => r.n));
      return `<ol class="tv-standings">${rows.map((r, i) => `<li style="--team:#f4cf6b;--share:${(r.n / top).toFixed(3)};--i:${i}"><span class="tv-rank">${escape(r.p.emoji)}</span><span class="tv-standing-name">${escape(r.p.name)}</span><span class="tv-bar"><i></i></span><b>${r.n} ${r.n === 1 ? 'vote' : 'votes'}</b></li>`).join('')}</ol>`;
    }
    const countVotes = votes => { const counts = {}; Object.values(votes).forEach(id => { counts[id] = (counts[id] || 0) + 1; }); return counts; };
    const lower = text => text.charAt(0).toLowerCase() + text.slice(1);

    function imposterTable(g) {
      const kicker = `<span class="tv-kicker">GUESS THE IMPOSTER · ROUND ${g.round}</span>`;
      const seenCount = g.players.filter(p => p.seen).length;
      if (g.phase === 'roles') return `${kicker}<h2 id="dialog-title" class="tv-title tv-title-small">Check your phones! 🤫</h2><p class="tv-lede">Everyone has a secret. Tap your phone to peek at your role, privately.</p>${checklist(g.players, 'seen')}<p class="tv-note">${seenCount} of ${g.players.length} have looked.</p><div class="dialog-actions">${hostButton('vote', 'Skip to the vote', false)}${hostButton('discuss', `Start the clues · ${g.duration / 60} min`)}</div>`;
      if (g.phase === 'discussion') return `${kicker}<h2 id="dialog-title" class="tv-title tv-title-small">🗣️ Clue time!</h2><p class="tv-lede"><b>${who(person(g.firstSpeakerId))}</b> goes first. One short clue each, then argue it out.</p><div class="tv-clock tv-clock-big" data-countdown role="timer" aria-label="Discussion time left"><span></span></div><div class="dialog-actions">${hostButton('vote', 'Time to vote 🗳️')}</div>`;
      if (g.phase === 'voting') {
        const missing = g.players.length - g.votes;
        return `${kicker}<h2 id="dialog-title" class="tv-title tv-title-small">Vote on your phones! 🗳️</h2><p class="tv-lede">Who’s bluffing? Votes stay secret until the reveal.</p>${checklist(g.players, 'voted')}<p class="tv-note">${g.votes} of ${g.players.length} votes in.</p><div class="dialog-actions">${hostButton('reveal', missing ? `Reveal now · ${missing} still voting` : 'Reveal the imposter 😈', !missing, g.votes === 0)}</div>`;
      }
      const bars = voteBars(g.counts || {});
      if (g.phase === 'last-guess') return `${kicker}<div class="tv-emote" aria-hidden="true">😬</div><h2 id="dialog-title" class="tv-title tv-title-small">${who(person(g.accusedId))} was caught!</h2><p class="tv-lede">The imposter gets one last guess at the secret word, on their phone…</p>${bars}<div class="dialog-actions">${hostButton('reveal', 'Skip their guess', false)}</div>`;
      const groupWon = g.winner === 'group';
      const headline = g.outcome === 'tie' ? 'A tie! The imposter slips away.' : groupWon ? 'The group wins! 🎉' : g.outcome === 'imposter-caught' ? 'Caught… but they guessed it! 🤯' : 'The imposter wins! 😈';
      return `${kicker}<div class="tv-emote" aria-hidden="true">${groupWon ? '🕵️' : '😈'}</div><h2 id="dialog-title" class="tv-title tv-title-small">${escape(headline)}</h2>
        <div class="ph-reveal-card"><span class="tv-kicker">THE IMPOSTER WAS</span><div class="ph-face big">${escape(person(g.imposterId).emoji)}</div><h3>${escape(person(g.imposterId).name)}</h3><span class="tv-kicker">THE SECRET WORD WAS</span><p class="ph-word">${escape(g.word)}</p>${g.guess ? `<p class="tv-note">Their guess: “${escape(g.guess)}”</p>` : ''}</div>${bars}${feedMarkup()}
        <div class="dialog-actions">${secondary('close', 'Close table')}${hostButton('next', 'New secret word ↺')}</div>`;
    }

    function bombTable(g) {
      const holder = person(g.holderId);
      const kicker = `<span class="tv-kicker">PASS THE BOMB · ROUND ${g.round} OF ${g.rounds}</span>`;
      const board = `<ol class="tv-standings">${[...g.players].sort((a, b) => b.blasts - a.blasts).map((p, i) => `<li style="--team:#fa7655;--share:${(p.blasts / Math.max(1, ...g.players.map(x => x.blasts))).toFixed(3)};--i:${i}"><span class="tv-rank">${escape(p.emoji)}</span><span class="tv-standing-name">${escape(p.name)}</span><span class="tv-bar"><i></i></span><b>${'💣'.repeat(p.blasts) || '0'}</b></li>`).join('')}</ol>`;
      if (g.phase === 'over') {
        const fewest = Math.min(...g.players.map(p => p.blasts));
        const cool = g.players.filter(p => p.blasts === fewest).map(p => p.name).join(' & ');
        return `${kicker}<div class="tv-trophy" aria-hidden="true">😎</div><h2 id="dialog-title" class="tv-title tv-title-small">${escape(cool)} kept their cool!</h2>${board}${feedMarkup()}`;
      }
      if (g.phase === 'boom') return `${kicker}<div class="ph-bomb is-boom" aria-hidden="true">💥</div><h2 id="dialog-title" class="tv-title tv-title-small">BOOM! ${who(person(g.lastBlastId))} was holding it!</h2>${board}${feedMarkup()}<div class="dialog-actions">${hostButton('next', g.round >= g.rounds ? 'Final results' : `Round ${g.round + 1} ↗`)}</div>`;
      const ready = g.phase === 'ready';
      return `${kicker}<div class="ph-holder"><span class="ph-face big ph-glow">${escape(holder.emoji)}</span><div><h2 id="dialog-title" class="tv-title tv-title-small">${escape(holder.name)} ${ready ? 'starts with the bomb' : 'has the bomb!'}</h2><p class="tv-lede">${ready ? 'Their phone glows green. Light the fuse when everyone’s ready.' : `${g.passes} ${g.passes === 1 ? 'pass' : 'passes'} so far. Answer, then tap Pass!`}</p></div></div>
        <div class="tv-question tv-prompt ph-bomb-question"><span class="tv-question-meta">${escape(holder.name.toUpperCase())}, NAME SOMETHING THAT FITS</span><h3 class="tv-prompt-text">${escape(g.prompt)}</h3></div>
        <div class="ph-bomb tempo-${g.tempo}" aria-hidden="true">💣</div>${ready ? `<div class="dialog-actions">${hostButton('light', 'Light the fuse 🔥')}</div>` : ''}`;
    }

    function likelyTable(g) {
      const kicker = `<span class="tv-kicker">MOST LIKELY TO · ROUND ${g.round} OF ${g.rounds}</span>`;
      if (g.phase === 'over') {
        const titles = g.summary.titles;
        const ranked = view.players.filter(p => titles[p.id]).sort((a, b) => titles[b.id].length - titles[a.id].length);
        return `<span class="tv-kicker">MOST LIKELY TO · THE AWARDS</span><div class="tv-trophy" aria-hidden="true">🏅</div><h2 id="dialog-title" class="tv-title tv-title-small">${ranked.length ? `${escape(ranked[0].name)} collected the most titles!` : 'No titles handed out!'}</h2><ul class="tv-awards">${ranked.map((p, i) => `<li style="--i:${i}"><span class="tv-avatar" aria-hidden="true">${escape(p.emoji)}</span><b>${escape(p.name)}</b><span>Most likely to ${titles[p.id].map(t => escape(lower(t))).join(', ')}</span></li>`).join('')}</ul>`;
      }
      if (g.phase === 'reveal') {
        const counts = countVotes(g.result.votes);
        const top = Math.max(...Object.values(counts));
        const winners = view.players.filter(p => counts[p.id] === top);
        return `${kicker}<div class="tv-emote" aria-hidden="true">👉</div><h2 id="dialog-title" class="tv-title tv-title-small">${winners.map(who).join(' & ')}!</h2><p class="tv-lede">Most likely to ${escape(lower(g.result.prompt))}.</p>${voteBars(counts)}${feedMarkup()}<div class="dialog-actions">${hostButton('next', g.round >= g.rounds ? 'See the awards 🏅' : 'Next prompt ↗')}</div>`;
      }
      return `${kicker}<h2 id="dialog-title" class="tv-title tv-title-small">Who’s most likely to ${escape(lower(g.prompt))}?</h2><p class="tv-lede">Vote in secret on your phones. Yes, you can vote for yourself.</p>${checklist(g.players, 'voted')}<p class="tv-note">${g.votes} of ${g.players.length} votes in.</p><div class="dialog-actions">${hostButton('reveal', 'Reveal the votes 👉', true, g.votes === 0)}</div>`;
    }

    function ratherTable(g) {
      const kicker = `<span class="tv-kicker">WOULD YOU RATHER · ${g.round} OF ${g.rounds}</span>`;
      if (g.phase === 'over') {
        const rebels = g.summary.rebels;
        const ranked = view.players.filter(p => rebels[p.id]).sort((a, b) => rebels[b.id] - rebels[a.id]);
        return `<span class="tv-kicker">WOULD YOU RATHER · THE VERDICT</span><div class="tv-trophy" aria-hidden="true">🦄</div><h2 id="dialog-title" class="tv-title tv-title-small">${ranked.length ? `${escape(ranked[0].name)} is the biggest rebel!` : 'You all think alike!'}</h2><ul class="tv-awards">${ranked.map((p, i) => `<li style="--i:${i}"><span class="tv-avatar" aria-hidden="true">${escape(p.emoji)}</span><b>${escape(p.name)}</b><span>Went against the crowd ${rebels[p.id]} ${rebels[p.id] === 1 ? 'time' : 'times'}</span></li>`).join('')}</ul>`;
      }
      const prompt = g.phase === 'reveal' ? g.result.prompt : g.prompt;
      const voters = side => g.phase === 'reveal' ? view.players.filter(p => g.result.votes[p.id] === side) : [];
      const tiles = ['a', 'b'].map((side, i) => `<div class="tv-tile ${side === 'a' ? 'tile-a' : 'tile-c'} ph-side" style="--i:${i}"><span class="tv-tile-letter">${side.toUpperCase()}</span><span class="tv-tile-text">${escape(prompt[side])}${g.phase === 'reveal' ? `<span class="ph-voters">${voters(side).map(p => escape(p.emoji)).join(' ') || '—'} <b>${voters(side).length}</b></span>` : ''}</span></div>`).join('');
      if (g.phase === 'reveal') return `${kicker}<h2 id="dialog-title" class="tv-title tv-title-small">The room has spoken!</h2><div class="tv-tiles ph-sides">${tiles}</div>${feedMarkup()}<div class="dialog-actions">${hostButton('next', g.round >= g.rounds ? 'See the verdict 🦄' : 'Next dilemma ↗')}</div>`;
      return `${kicker}<h2 id="dialog-title" class="tv-title tv-title-small">Would you rather…</h2><div class="tv-tiles ph-sides">${tiles}</div>${checklist(g.players, 'voted')}<p class="tv-note">${g.votes} of ${g.players.length} picked a side.</p><div class="dialog-actions">${hostButton('reveal', 'Reveal the split ⚔️', true, g.votes === 0)}</div>`;
    }

    // Phase changes in party games get sounds, commentary and emojis on the big screen.
    function reactParty(g) {
      const key = `${g.phase}|${g.round}`;
      if (seen.key === key) return;
      const first = seen.key === undefined;
      seen.key = key;
      if (first) return;
      if (gameId === 'imposter') {
        if (g.phase === 'discussion') emit('onSound', 'start');
        else if (g.phase === 'voting') emit('onSound', 'whistle');
        else if (g.phase === 'last-guess') { emit('onSound', 'reveal'); emit('react', '😬'); }
        else if (g.phase === 'result') {
          const name = person(g.imposterId).name;
          say(g.winner === 'group' ? 'imp-caught' : g.outcome === 'imposter-caught' ? 'imp-stole' : 'imp-escaped', { name });
          emit('onSound', g.winner === 'group' ? 'champion' : 'wrong');
          if (g.winner === 'group') emit('onCelebrate', 160);
        } else if (g.phase === 'roles') { feed.length = 0; emit('onSound', 'shuffle'); }
      } else if (gameId === 'pass-bomb') {
        if (g.phase === 'ticking') emit('onSound', 'start');
        else if (g.phase === 'boom') { say('boom', { name: person(g.lastBlastId).name }); emit('onSound', 'buzzer'); }
        else if (g.phase === 'over') { emit('onSound', 'champion'); emit('onCelebrate', 160); }
        else if (g.phase === 'ready' && g.round === 1) feed.length = 0;
      } else {
        if (g.phase === 'reveal' && gameId === 'most-likely') {
          const counts = countVotes(g.result.votes);
          const top = Math.max(...Object.values(counts));
          say('vote', { name: view.players.filter(p => counts[p.id] === top).map(p => p.name).join(' & ') });
          emit('onSound', 'correct');
        } else if (g.phase === 'reveal') {
          const sides = Object.values(g.result.votes);
          say(new Set(sides).size === 1 && sides.length > 1 ? 'wyr-same' : 'wyr-split', {});
          emit('onSound', 'reveal');
        } else if (g.phase === 'over') { emit('onSound', 'champion'); emit('onCelebrate', 140); }
        else if (g.phase === 'voting') { if (g.round === 1) feed.length = 0; emit('onSound', 'pop'); }
      }
    }
    // Keeps the discussion clock moving and the hidden fuse ticking between server updates.
    function pulse() {
      const g = view?.game;
      if (destroyed || !g) return;
      const clock = container.querySelector('[data-countdown]');
      if (clock && g.endsAt) {
        const left = Math.max(0, g.endsAt - Date.now());
        const seconds = Math.ceil(left / 1000);
        clock.querySelector('span').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        clock.style.setProperty('--p', (left / (g.duration * 1000)).toFixed(3));
        clock.classList.toggle('is-urgent', seconds <= 10);
      }
      if (gameId === 'pass-bomb' && g.phase === 'ticking') {
        const gap = { 1: 900, 2: 450, 3: 200 }[g.tempo] || 900;
        if (Date.now() - seen.tick >= gap) { seen.tick = Date.now(); emit('onSound', 'tick'); }
      }
    }
    const timer = host.setInterval(pulse, 100);
    // Free hosting sleeps after a quiet spell; phones joining through the tunnel don't count as visits, so the big screen checks in.
    const keepAwake = host.setInterval(() => { Promise.resolve(host.fetch?.('/api/network')).catch(() => {}); }, 240000);
    seen.tick = 0;

    function render() {
      if (destroyed || !view) return;
      if (!view.started) { show(lobby()); return; }
      const g = view.game;
      if (PARTY.includes(gameId)) {
        const body = { imposter: imposterTable, 'pass-bomb': bombTable, 'most-likely': likelyTable, 'would-you-rather': ratherTable }[gameId](g);
        const over = g.phase === 'over';
        const ownActions = gameId === 'imposter' && g.phase === 'result';
        show(`${body}${ownActions ? '' : `<div class="dialog-actions ph-table-tools">${secondary('close', 'Close table')}${over ? '<button type="button" class="button tv-button" data-phone-action="rematch">Play again ↺</button>' : ''}</div>`}${options.reactions || ''}`);
        pulse();
        return;
      }
      const over = Boolean(g.winnerId || g.winnerIds || g.draw);
      const body = gameId === 'matatu' ? matatuTable(g) : gameId === 'rps' ? duel(g) : four(g);
      show(`${body}<div class="dialog-actions">${secondary('close', 'Close table')}${over ? '<button type="button" class="button tv-button" data-phone-action="rematch">Rematch ↺</button>' : ''}</div>${options.reactions || ''}`);
    }

    async function onClick(event) {
      const remove = event.target.closest('[data-phone-remove]');
      const hostMove = event.target.closest('[data-phone-host]')?.dataset.phoneHost;
      if (hostMove && room) {
        try { await call(`/api/rooms/${room.code}/action`, { hostKey: room.hostKey, action: { type: hostMove } }); }
        catch (error) { emit('toast', error.message); }
        return;
      }
      const action = event.target.closest('[data-phone-action]')?.dataset.phoneAction;
      try {
        if (remove && room) await call(`/api/rooms/${room.code}/remove`, { hostKey: room.hostKey, playerId: remove.dataset.phoneRemove });
        else if (action === 'start' && room) { await call(`/api/rooms/${room.code}/start`, { hostKey: room.hostKey }); emit('onSound', 'start'); }
        else if (action === 'rematch' && room) { feed.length = 0; await call(`/api/rooms/${room.code}/action`, { hostKey: room.hostKey, action: { type: 'rematch' } }); }
        else if (action === 'close') { const done = options.onClose; destroy(); done?.(); }
      } catch (error) { emit('toast', error.message); }
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      host.clearInterval(timer);
      host.clearInterval(keepAwake);
      source?.close();
      if (room) call(`/api/rooms/${room.code}/close`, { hostKey: room.hostKey }).catch(() => {});
      container.removeEventListener('click', onClick);
    }
    container.addEventListener('click', onClick);
    open();
    return Object.freeze({ destroy, get code() { return room?.code || null; } });
  }

  return Object.freeze({ create });
});
