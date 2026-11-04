(() => {
  'use strict';
  // The phone side of a phone game: join with a name and face, then see only your own cards or controls.
  const FACES = ['🦁', '🐯', '🦊', '🐼', '🐸', '🐵', '🐨', '🦄', '🐙', '🦉', '🐧', '🐢', '🦒', '🐘', '🦓', '🦩', '🐬', '🦋', '🐝', '🐞'];
  const SUITS = ['♠', '♥', '♦', '♣'];
  const THROWS = [['rock', '✊', 'Rock'], ['paper', '✋', 'Paper'], ['scissors', '✌️', 'Scissors']];
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const app = $('#app');
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const write = (key, value) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private mode: the seat lasts for this tab only. */ } };

  let code = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  let seat = code ? read(`gn-seat-${code}`) : null;
  const profile = read('gn-profile') || { name: '', emoji: FACES[Math.floor(Math.random() * FACES.length)] };
  let view = null;
  let choosingSuitFor = null;
  let busy = false;
  let lastBuzz = '';
  let showRole = false;
  let roleRound = 0;
  let toastTimer;

  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').classList.add('show');
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2600);
  }
  async function post(path, body) {
    const response = await fetch(`/api/rooms/${code}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Something went wrong. Try again.');
    return data;
  }
  async function act(action) {
    if (busy) return;
    busy = true;
    try { await post('action', { playerId: seat.playerId, key: seat.key, action }); }
    catch (error) { toast(error.message); }
    finally { busy = false; }
  }

  function renderJoin(problem = '') {
    app.innerHTML = `<section class="join"><div class="brand">game night<span>.</span></div><h1>Join the table</h1><p class="lede">Your cards and moves show up on this phone. The big screen shows the table.</p>
      <form id="join-form" novalidate>${code ? `<p class="code-chip">Table <b>${escape(code)}</b></p>` : '<label>Table code<input id="code" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="ABCD" required></label>'}
      <label>Your name<input id="name" maxlength="16" autocomplete="nickname" placeholder="What should we call you?" value="${escape(profile.name)}" required></label>
      <fieldset class="faces"><legend>Pick your face</legend>${FACES.map(face => `<button type="button" data-face="${face}" aria-pressed="${face === profile.emoji}" aria-label="Face ${face}">${face}</button>`).join('')}</fieldset>
      <p class="problem" role="alert">${escape(problem)}</p><button class="big" type="submit">Take a seat ↗</button></form></section>`;
  }

  async function join(event) {
    event.preventDefault();
    if (!code) code = ($('#code')?.value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    const name = $('#name').value.trim();
    if (code.length !== 4) { $('.problem').textContent = 'Type the 4-letter code from the big screen.'; return; }
    if (!name) { $('.problem').textContent = 'Type your name to join.'; $('#name').focus(); return; }
    profile.name = name;
    write('gn-profile', profile);
    try {
      seat = await post('join', { name, emoji: profile.emoji, ...(read(`gn-seat-${code}`) || {}) });
      write(`gn-seat-${code}`, seat);
      history.replaceState(null, '', `?room=${code}`);
      connect();
    } catch (error) {
      $('.problem').textContent = error.message;
      if (/doesn’t exist/.test(error.message)) code = '';
    }
  }

  // Long-polling: ask "anything new since version N?" and the server answers the moment something
  // changes. Plain requests like this pass through every proxy and tunnel without being held back.
  let listening = 0;
  async function connect() {
    const run = ++listening;
    view = null;
    app.innerHTML = '<section class="waiting"><div class="spinner" aria-hidden="true"></div><p>Finding your seat…</p></section>';
    setTimeout(() => { if (!view && run === listening) { const note = app.querySelector('.waiting p'); if (note) note.textContent = 'Waking up the server. This can take up to a minute…'; } }, 5000);
    let since = -1;
    while (run === listening && seat) {
      let response;
      let data;
      try {
        response = await fetch(`/api/rooms/${code}/poll?player=${encodeURIComponent(seat.playerId)}&key=${encodeURIComponent(seat.key)}&since=${since}`, { cache: 'no-store' });
        data = await response.json().catch(() => ({}));
      } catch {
        if (run !== listening) return;
        document.body.classList.add('offline');
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      if (run !== listening) return;
      if (!response.ok) {
        // The table is gone or this seat is no longer valid: back to the join screen.
        write(`gn-seat-${code}`, null);
        seat = null;
        renderJoin(data.error || 'That table is no longer open.');
        return;
      }
      document.body.classList.remove('offline');
      if (data.closed) {
        write(`gn-seat-${code}`, null);
        app.innerHTML = '<section class="waiting"><div class="big-emoji">👋</div><h1>The table is closed.</h1><p>Thanks for playing! Scan the next code on the big screen to join another game.</p></section>';
        return;
      }
      if (data.version !== since) {
        since = data.version;
        view = data;
        // A drawing bug must never stop the phone listening for the next move.
        try { render(); } catch (error) { console.error('Could not draw the table', error); }
      }
    }
  }

  const red = card => card.suit === '♥' || card.suit === '♦';
  const cardFace = (card, extra = '') => `<span class="pcard ${red(card) ? 'red' : ''} ${extra}"><span class="corner">${escape(card.rank)}<br>${card.suit}</span><span class="pip">${card.suit}</span></span>`;
  const playerName = id => view.players.find(p => p.id === id) || { name: 'Someone', emoji: '🙂' };

  function buzzOnTurn(key) {
    if (key && key !== lastBuzz) { lastBuzz = key; try { navigator.vibrate?.(90); } catch { /* Not every phone can buzz. */ } }
  }

  // Matatu power cards get a small badge so you can see what each one does at a glance.
  const BADGES = { two: '+2', skip: '⏭', ace: '★', cut: '✂️' };
  function renderMatatu(g) {
    const you = g.you;
    const turn = playerName(g.turnId);
    const top = g.top;
    const cutLabel = `<b class="${red({ suit: g.cutSuit }) ? 'red' : ''}">7${g.cutSuit}</b>`;
    if (g.winnerIds) {
      const won = g.winnerIds.includes(view.you.id);
      const cutter = g.cutterId && playerName(g.cutterId);
      const headline = g.ending === 'empty' ? (won ? 'You played every card. You win! 🏆' : `${faceName(playerName(g.winnerIds[0]))} played every card and wins.`) : `✂️ ${cutter.id === view.you.id ? 'You' : faceName(cutter)} cut the game!`;
      const ranked = [...g.players].sort((a, b) => g.scores[a.id] - g.scores[b.id]);
      return `<div class="result">${won ? '🏆' : g.ending === 'cut' ? '✂️' : '😵'}<h2>${headline}</h2><p>${won ? 'Lowest points: you win!' : `You finished with ${g.scores[view.you.id]} points.`}</p></div>
        <ul class="blasts">${ranked.map(p => `<li class="${g.winnerIds.includes(p.id) ? 'is-winner' : ''}">${faceName(p)} <b>${g.scores[p.id]} pts</b></li>`).join('')}</ul>
        <div class="actions"><button class="big" data-act="rematch">Rematch ↺</button></div>`;
    }
    let status;
    if (you.yourTurn && g.pending) status = `⚠️ Answer with a 2, or pick <b>${g.pending}</b>!`;
    else if (you.yourTurn) status = `Your turn! Follow <b class="${red({ suit: g.suit }) ? 'red' : ''}">${g.suit}</b> or <b>${escape(top.rank)}</b>, play an Ace, or pick.`;
    else status = `Waiting for ${turn.emoji} ${escape(turn.name)}…${g.pending ? ` They must answer a 2 or pick ${g.pending}.` : ''}`;
    buzzOnTurn(you.yourTurn ? `${g.turnId}-${g.events[g.events.length - 1].seq}` : '');
    const others = g.players.filter(p => p.id !== view.you.id).map(p => `<li class="${p.id === g.turnId ? 'is-turn' : ''}">${p.emoji} ${escape(p.name)} <b>${p.cards}</b></li>`).join('');
    const pickLabel = g.pending ? `Pick ${g.pending} 😵` : 'Pick a card 🎣';
    return `<p class="status ${you.yourTurn ? 'your-turn' : ''} ${g.pending && you.yourTurn ? 'danger' : ''}">${status}</p>
      <ul class="others">${others}</ul>
      <div class="table-mini"><div class="pile"><span class="pcard back"></span><small>${g.deckCount} to pick</small></div><div class="pile">${cardFace(top, 'top')}<small>Now: <b class="${red({ suit: g.suit }) ? 'red' : ''}">${g.suit}</b></small></div><div class="pile cut-pile">${cardFace(g.cutCard, 'cut')}<small>${cutLabel} cuts ✂️</small></div></div>
      <div class="hand" role="group" aria-label="Your cards">${you.hand.map((card, i) => `<button type="button" class="hand-card ${card.playable ? 'playable' : ''} ${card.power ? `power-${card.power}` : ''}" data-card="${escape(card.id)}" style="--i:${i}" ${you.yourTurn ? '' : 'aria-disabled="true"'} aria-label="${escape(card.rank)} of ${card.suit}${card.power ? `, ${card.power === 'cut' ? 'the cutter' : card.power}` : ''}${card.playable ? ', playable' : ''}">${cardFace(card)}${card.power ? `<span class="badge">${BADGES[card.power]}</span>` : ''}</button>`).join('')}</div>
      <p class="hint">Your hand: <b>${you.points} points</b>. Lowest wins if someone cuts.</p>
      <div class="actions"><button class="big" data-act="pick" ${you.yourTurn ? '' : 'disabled'}>${pickLabel}</button></div>
      <details class="guide"><summary>What each card does</summary><ul><li><b>2</b> Next player picks 2, unless they answer with a 2 (then the next picks 4…)</li><li><b>8 or J</b> Skips the next player</li><li><b>A</b> Goes on anything. You choose the suit</li><li>${cutLabel} <b>The cutter.</b> Ends the game. Everyone counts their hand: lowest points wins</li><li><b>Points</b> A 15 · 2 is 20 · J 11 · Q 12 · K 13 · others face value</li></ul></details>
      ${choosingSuitFor ? `<div class="sheet" role="dialog" aria-label="Choose a suit"><div class="sheet-card"><h2>Ace! Choose the suit ★</h2><p>Everyone must follow the suit you pick.</p><div class="suits">${SUITS.map(suit => `<button type="button" data-suit="${suit}" class="${suit === '♥' || suit === '♦' ? 'red' : ''}">${suit}</button>`).join('')}</div><button class="ghost" data-act="cancel-suit">Keep my Ace</button></div></div>` : ''}`;
  }

  function renderRps(g) {
    const me = g.players.find(p => p.id === view.you.id);
    const rival = g.players.find(p => p.id !== view.you.id);
    const last = g.last;
    const throwEmoji = choice => THROWS.find(([id]) => id === choice)?.[1] || '❔';
    const lastLine = last ? `<p class="last-round">${throwEmoji(last.picks[me.id])} vs ${throwEmoji(last.picks[rival.id])} · ${last.winnerId === null ? 'Tie!' : last.winnerId === me.id ? 'You won the round! 🎉' : `${escape(rival.name)} won the round.`}</p>` : '';
    const score = `<div class="duel-score"><span>${me.emoji} You <b>${me.score}</b></span><small>first to ${g.target}</small><span><b>${rival.score}</b> ${escape(rival.name)} ${rival.emoji}</span></div>`;
    if (g.winnerId) return `${score}${lastLine}<div class="result">${g.winnerId === me.id ? '🏆<h2>You win the duel!</h2>' : `😵<h2>${escape(rival.name)} wins the duel.</h2>`}</div><div class="actions"><button class="big" data-act="rematch">Rematch ↺</button></div>`;
    buzzOnTurn(g.you.choice ? '' : `rps-${g.round}`);
    if (g.you.choice) return `${score}${lastLine}<div class="result">🤫<h2>${throwEmoji(g.you.choice)} locked in</h2><p>${rival.thrown ? 'Revealing…' : `Waiting for ${escape(rival.name)} to throw…`}</p></div>`;
    return `${score}${lastLine}<p class="status your-turn">Round ${g.round}: make your throw in secret!</p><div class="throws">${THROWS.map(([id, emoji, label]) => `<button type="button" data-throw="${id}" aria-label="${label}"><span>${emoji}</span>${label}</button>`).join('')}</div>`;
  }

  function renderFour(g) {
    const you = g.you;
    const me = g.players[you.seat];
    const rival = g.players[1 - you.seat];
    const status = g.winnerId ? (g.winnerId === me.id ? '🏆 Four in a row! You win!' : `${rival.emoji} ${escape(rival.name)} connected four.`) : g.draw ? '🤝 The board is full. A draw!' : you.yourTurn ? 'Your turn! Tap a column to drop a disc.' : `Waiting for ${rival.emoji} ${escape(rival.name)}…`;
    buzzOnTurn(you.yourTurn ? `four-${g.seq}` : '');
    const winning = new Set((g.line || []).map(([r, c]) => `${r}-${c}`));
    const board = g.board.map((row, r) => row.map((cell, c) => `<span class="slot ${cell === null ? '' : `disc-${cell}`} ${winning.has(`${r}-${c}`) ? 'win' : ''}"></span>`).join('')).join('');
    return `<p class="status ${you.yourTurn ? 'your-turn' : ''}">${status}</p><p class="you-are">You are <span class="disc-chip disc-${you.seat}"></span></p>
      <div class="four"><div class="drops">${g.board[0].map((cell, c) => `<button type="button" data-column="${c}" aria-label="Drop in column ${c + 1}" ${you.yourTurn && cell === null ? '' : 'disabled'}>▼</button>`).join('')}</div><div class="grid">${board}</div></div>
      ${g.winnerId || g.draw ? '<div class="actions"><button class="big" data-act="rematch">Rematch ↺</button></div>' : ''}`;
  }

  // --- Party games on phones ------------------------------------------------------
  const faceName = p => `${p.emoji} ${escape(p.name)}`;
  function playerGrid(players, chosen, attribute) {
    return `<div class="player-grid">${players.map(p => `<button type="button" class="pick ${p.id === chosen ? 'chosen' : ''}" ${attribute}="${escape(p.id)}" aria-pressed="${p.id === chosen}"><span>${p.emoji}</span>${escape(p.name)}</button>`).join('')}</div>`;
  }

  function renderImposter(g) {
    const you = g.you;
    const first = playerName(g.firstSpeakerId);
    if (roleRound !== g.round) { roleRound = g.round; showRole = false; }
    const role = showRole
      ? `<div class="role ${you.imposter ? 'is-imposter' : 'is-word'}">${you.imposter
        ? `<div class="big-emoji">😈</div><small>YOUR ROLE</small><h2>You are the imposter</h2><p>You don’t know the word. The category is <b>${escape(g.label)}</b>. Listen closely and blend in!</p>`
        : `<div class="big-emoji">🤫</div><small>THE SECRET WORD</small><h2>${escape(you.word)}</h2><p>Category: ${escape(g.label)}. Give a subtle clue, but never say the word!</p>`}<button type="button" class="ghost" data-act="hide-role">Hide my role</button></div>`
      : '<button type="button" class="role-cover" data-act="show-role"><span>🔒</span>Tap to see your secret role<small>Check nobody is peeking at your screen</small></button>';
    if (g.phase === 'roles') return `<p class="status your-turn">🤫 Everyone has a secret. Check yours, then look at the big screen.</p>${role}`;
    if (g.phase === 'discussion') return `<p class="status">🗣️ Clue time! ${faceName(first)} goes first. One short clue each.</p>${role}`;
    if (g.phase === 'voting') {
      buzzOnTurn(`imp-vote-${g.round}`);
      const others = g.players.filter(p => p.id !== view.you.id);
      const chosen = others.find(p => p.id === you.votedFor);
      return `<p class="status your-turn">🗳️ Who is the imposter? Vote in secret.</p>${playerGrid(others, you.votedFor, 'data-vote-for')}<p class="hint">${chosen ? `Your vote: <b>${faceName(chosen)}</b>. You can change it until the reveal.` : 'Tap a name to vote.'} ${g.votes} of ${g.players.length} votes in.</p>`;
    }
    const accused = playerName(g.accusedId);
    if (g.phase === 'last-guess') {
      if (you.imposter) {
        buzzOnTurn('imp-guess');
        return `<div class="role is-imposter"><div class="big-emoji">😬</div><h2>You’ve been caught!</h2><p>One last chance: guess the secret word to steal the win.</p><form id="guess-form" class="guess"><input id="guess" maxlength="100" autocomplete="off" placeholder="The secret word is…" required><button class="big" type="submit">Lock in my guess</button><button class="ghost" type="button" data-act="give-up">I don’t know</button></form></div>`;
      }
      return `<div class="result">😮<h2>${faceName(accused)} was caught!</h2><p>They’re making one last guess at the word on their phone…</p></div>`;
    }
    const imposterPlayer = playerName(g.imposterId);
    const groupWon = g.winner === 'group';
    const mine = you.imposter ? (groupWon ? 'You got caught. Better luck next time! 😅' : 'You fooled them all! 😈') : groupWon ? 'Your team sniffed out the imposter! 🎉' : 'The imposter got away… 🙈';
    return `<div class="result">${groupWon ? '🎉' : '😈'}<h2>${groupWon ? 'The group wins!' : 'The imposter wins!'}</h2><p>${mine}</p><p>The imposter was <b>${faceName(imposterPlayer)}</b>. The word was <b>${escape(g.word)}</b>.${g.guess ? ` Their guess: “${escape(g.guess)}”.` : ''}</p></div><p class="hint">Watch the big screen for the next secret word.</p>`;
  }

  function renderBomb(g) {
    const holder = playerName(g.holderId);
    const you = g.you;
    document.body.classList.toggle('holding', you.holding);
    document.body.classList.toggle('exploded', g.phase === 'boom' && g.lastBlastId === view.you.id);
    document.body.dataset.tempo = String(g.tempo || 1);
    buzzOnTurn(you.holding ? `bomb-${g.round}-${g.passes}` : '');
    const board = `<ul class="blasts">${[...g.players].sort((a, b) => b.blasts - a.blasts).map(p => `<li>${faceName(p)} <b>${'💣'.repeat(p.blasts) || '—'}</b></li>`).join('')}</ul>`;
    if (g.phase === 'over') {
      const fewest = Math.min(...g.players.map(p => p.blasts));
      const mine = g.players.find(p => p.id === view.you.id).blasts;
      return `<div class="result">${mine === fewest ? '😎' : '💥'}<h2>${mine === fewest ? 'You kept your cool!' : `You blew up ${mine} ${mine === 1 ? 'time' : 'times'}.`}</h2><p>Fewest bombs wins.</p></div>${board}`;
    }
    if (g.phase === 'boom') {
      const blown = playerName(g.lastBlastId);
      return `<div class="result">${g.lastBlastId === view.you.id ? '💥<h2>BOOM! You were holding it!</h2>' : `😮‍💨<h2>Phew! It blew up on ${faceName(blown)}.</h2>`}<p>Round ${g.round} of ${g.rounds}. Waiting for the big screen…</p></div>${board}`;
    }
    if (you.holding) {
      return `<div class="bomb-zone"><div class="bomb-big" aria-hidden="true">💣</div><p class="bomb-label">${g.phase === 'ready' ? 'You start with the bomb!' : 'YOU HAVE THE BOMB! Answer out loud:'}</p><h2 class="bomb-question">${escape(g.prompt)}</h2></div>
        <div class="actions">${g.phase === 'ready' ? '<button class="big" data-act="light">Light the fuse 🔥</button>' : '<button class="big pass-btn" data-act="pass">Answered! Pass it ➜</button>'}</div>`;
    }
    return `<div class="result">${g.phase === 'ready' ? '😬' : '😅'}<h2>${faceName(holder)} has the bomb</h2><p>${g.phase === 'ready' ? 'Get ready. When it lands on you, your screen turns green.' : `Their question: <b>${escape(g.prompt)}</b>`}</p></div><p class="hint">Round ${g.round} of ${g.rounds} · ${g.passes} ${g.passes === 1 ? 'pass' : 'passes'}</p>`;
  }

  function renderLikely(g) {
    const you = g.you;
    if (g.phase === 'over') {
      const titles = g.summary.titles[view.you.id] || [];
      return `<div class="result">${titles.length ? '🏅' : '😇'}<h2>${titles.length ? `You earned ${titles.length} ${titles.length === 1 ? 'title' : 'titles'}!` : 'No titles for you. Suspiciously innocent!'}</h2>${titles.length ? `<p>Most likely to ${titles.map(t => escape(t.charAt(0).toLowerCase() + t.slice(1))).join(', ')}.</p>` : ''}</div>`;
    }
    if (g.phase === 'reveal') {
      const counts = {};
      Object.values(g.result.votes).forEach(id => { counts[id] = (counts[id] || 0) + 1; });
      const top = Math.max(...Object.values(counts));
      const winners = Object.keys(counts).filter(id => counts[id] === top).map(playerName);
      return `<div class="result">👉<h2>${winners.map(faceName).join(' & ')}</h2><p>Most likely to ${escape(g.result.prompt.charAt(0).toLowerCase() + g.result.prompt.slice(1))}!${winners.some(w => w.id === view.you.id) ? ' That’s you! 😂' : ''}</p></div><p class="hint">Watch the big screen for the next one.</p>`;
    }
    buzzOnTurn(`likely-${g.round}`);
    return `<p class="status your-turn">Round ${g.round} of ${g.rounds}: who’s most likely to…</p><h2 class="question">${escape(g.prompt)}?</h2>${playerGrid(g.players, you.vote, 'data-vote-for')}<p class="hint">${you.vote ? 'Voted! You can change it until the reveal.' : 'Vote in secret. You can pick yourself.'} ${g.votes} of ${g.players.length} in.</p>`;
  }

  function renderRather(g) {
    const you = g.you;
    if (g.phase === 'over') {
      const rebels = g.summary.rebels[view.you.id] || 0;
      return `<div class="result">${rebels >= 3 ? '🦄' : '🤝'}<h2>${rebels ? `You were in the minority ${rebels} ${rebels === 1 ? 'time' : 'times'}.` : 'You always sided with the crowd!'}</h2><p>${rebels >= 3 ? 'A true rebel.' : 'Thanks for playing!'}</p></div>`;
    }
    if (g.phase === 'reveal') {
      const picks = Object.values(g.result.votes);
      const a = picks.filter(v => v === 'a').length;
      const b = picks.length - a;
      const mine = g.result.votes[view.you.id];
      const side = mine ? (mine === 'a' ? a : b) >= (mine === 'a' ? b : a) ? 'You’re with the crowd.' : 'You’re a rebel! 🦄' : 'You didn’t vote this time.';
      return `<div class="split"><div class="side-a" style="flex:${a || 0.2}"><b>${a}</b> A</div><div class="side-b" style="flex:${b || 0.2}"><b>${b}</b> B</div></div><p class="status">${side}</p><p class="hint">Watch the big screen for the next dilemma.</p>`;
    }
    buzzOnTurn(`wyr-${g.round}`);
    return `<p class="status your-turn">Dilemma ${g.round} of ${g.rounds}: would you rather…</p><div class="sides">${['a', 'b'].map(side => `<button type="button" class="side side-${side} ${you.vote === side ? 'chosen' : ''}" data-side="${side}" aria-pressed="${you.vote === side}"><small>${side.toUpperCase()}</small>${escape(g.prompt[side])}</button>`).join('')}</div><p class="hint">${you.vote ? 'Locked in. You can switch until the reveal.' : 'Pick a side in secret.'} ${g.votes} of ${g.players.length} in.</p>`;
  }

  function render() {
    if (!view) return;
    if (view.gameId !== 'pass-bomb' || !view.started) { document.body.classList.remove('holding', 'exploded'); }
    const head = `<header class="bar"><span class="me">${view.you.emoji} ${escape(view.you.name)}</span><span class="table-code">${escape(view.title)} · ${escape(view.code)}</span></header>`;
    let body;
    if (!view.started) {
      const needed = Math.max(0, view.min - view.players.length);
      body = `<section class="waiting"><div class="big-emoji">${view.you.emoji}</div><h1>You’re in!</h1><p>${needed ? `Waiting for ${needed} more ${needed === 1 ? 'player' : 'players'}…` : 'Waiting for the host to start the game…'}</p><ul class="lobby">${view.players.map(p => `<li>${p.emoji} ${escape(p.name)}${p.id === view.you.id ? ' <small>(you)</small>' : ''}</li>`).join('')}</ul></section>`;
    } else if (view.gameId === 'matatu') body = renderMatatu(view.game);
    else if (view.gameId === 'rps') body = renderRps(view.game);
    else if (view.gameId === 'imposter') body = renderImposter(view.game);
    else if (view.gameId === 'pass-bomb') body = renderBomb(view.game);
    else if (view.gameId === 'most-likely') body = renderLikely(view.game);
    else if (view.gameId === 'would-you-rather') body = renderRather(view.game);
    else body = renderFour(view.game);
    app.innerHTML = head + `<div class="game game-${view.gameId}">${body}</div>`;
  }

  app.addEventListener('submit', event => {
    if (event.target.id === 'join-form') join(event);
    if (event.target.id === 'guess-form') { event.preventDefault(); act({ type: 'guess', text: $('#guess').value }); }
  });
  app.addEventListener('click', event => {
    const face = event.target.closest('[data-face]');
    if (face) {
      profile.emoji = face.dataset.face;
      app.querySelectorAll('[data-face]').forEach(button => button.setAttribute('aria-pressed', String(button === face)));
      return;
    }
    if (!view?.game) return;
    const card = event.target.closest('[data-card]');
    if (card) {
      const chosen = view.game.you.hand.find(c => c.id === card.dataset.card);
      if (!view.game.you.yourTurn) { toast('Hold on, it’s not your turn yet.'); return; }
      if (!chosen.playable) { toast(view.game.pending ? `Answer with a 2, or pick ${view.game.pending}.` : `That doesn’t follow. Play a ${view.game.suit}, a ${view.game.top.rank}, or an Ace.`); card.classList.add('nope'); return; }
      if (chosen.rank === 'A') { choosingSuitFor = chosen.id; render(); return; }
      act({ type: 'play', cardId: chosen.id });
      return;
    }
    const suit = event.target.closest('[data-suit]');
    if (suit && choosingSuitFor) { const cardId = choosingSuitFor; choosingSuitFor = null; act({ type: 'play', cardId, suit: suit.dataset.suit }); return; }
    const thrown = event.target.closest('[data-throw]');
    if (thrown) { act({ type: 'throw', choice: thrown.dataset.throw }); return; }
    const target = event.target.closest('[data-vote-for]');
    if (target) { act({ type: 'vote', targetId: target.dataset.voteFor }); return; }
    const side = event.target.closest('[data-side]');
    if (side) { act({ type: 'vote', side: side.dataset.side }); return; }
    const column = event.target.closest('[data-column]');
    if (column) { act({ type: 'drop', column: Number(column.dataset.column) }); return; }
    const button = event.target.closest('[data-act]');
    if (!button) return;
    if (button.dataset.act === 'cancel-suit') { choosingSuitFor = null; render(); }
    else if (button.dataset.act === 'show-role') { showRole = true; render(); act({ type: 'seen' }); }
    else if (button.dataset.act === 'hide-role') { showRole = false; render(); }
    else act({ type: button.dataset.act });
  });

  if (code && seat) connect(); else renderJoin();
})();
