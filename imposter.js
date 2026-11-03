(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GameNightImposter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function randomIndex(length, rng) {
    const value = rng();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('The random source must return a number from 0 up to 1.');
    return Math.floor(value * length);
  }

  function normalizeGuess(value) {
    return String(value).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]/gu, '');
  }

  function createMatch(players, prompt, rng = Math.random) {
    if (!Array.isArray(players) || players.length < 3 || players.length > 12) throw new RangeError('Guess the Imposter needs 3–12 players.');
    if (typeof rng !== 'function') throw new TypeError('Expected a random source.');
    const ids = new Set();
    const ordered = players.map((player, index) => {
      if (!player || !['string', 'number'].includes(typeof player.id) || !String(player.id).trim() || (typeof player.id === 'number' && !Number.isFinite(player.id))) throw new TypeError('Each player needs a unique ID.');
      const id = String(player.id);
      if (ids.has(id)) throw new TypeError('Each player needs a unique ID.');
      ids.add(id);
      if (player.name !== undefined && typeof player.name !== 'string') throw new TypeError('Player names must be text.');
      return { id, name: (player.name || '').trim() || `Player ${index + 1}`, avatar: typeof player.avatar === 'string' ? player.avatar : '' };
    });
    if (!prompt || typeof prompt.text !== 'string' || !normalizeGuess(prompt.text)) throw new TypeError('A secret word is required.');
    const imposterId = ordered[randomIndex(ordered.length, rng)].id;
    for (let i = ordered.length - 1; i > 0; i -= 1) {
      const j = randomIndex(i + 1, rng);
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    }
    // Choose from everyone, including the imposter: the opening speaker never reveals a role.
    const firstSpeakerId = ordered[randomIndex(ordered.length, rng)].id;
    return {
      players: ordered,
      imposterId,
      firstSpeakerId,
      word: prompt.text.trim(),
      category: String(prompt.label || prompt.category || 'Mystery word')
    };
  }

  function resolveVotes(match, votes) {
    if (!match || !Array.isArray(match.players) || !Array.isArray(votes) || votes.length !== match.players.length) throw new RangeError('Every player must vote once.');
    const counts = new Map(match.players.map(player => [player.id, 0]));
    const voters = new Set();
    for (const vote of votes) {
      if (!vote || !counts.has(vote.voterId) || !counts.has(vote.targetId) || vote.voterId === vote.targetId || voters.has(vote.voterId)) throw new RangeError('Votes must name another player, once per voter.');
      voters.add(vote.voterId);
      counts.set(vote.targetId, counts.get(vote.targetId) + 1);
    }
    const highest = Math.max(...counts.values());
    const leaders = [...counts].filter(([, count]) => count === highest).map(([id]) => id);
    const accusedId = leaders.length === 1 ? leaders[0] : null;
    return {
      outcome: !accusedId ? 'tie' : accusedId === match.imposterId ? 'imposter-caught' : 'innocent-accused',
      accusedId,
      counts: match.players.map(player => ({ id: player.id, count: counts.get(player.id) }))
    };
  }

  function create(options) {
    if (!options?.container || typeof options.container.addEventListener !== 'function') throw new TypeError('An Imposter game container is required.');
    const { container } = options;
    const host = container.ownerDocument.defaultView;
    const match = createMatch(options.players, options.prompt, options.rng || Math.random);
    const duration = options.duration === undefined ? 180 : Number(options.duration);
    if (![60, 120, 180, 300].includes(duration)) throw new RangeError('Choose 60, 120, 180, or 300 seconds for discussion.');
    const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const playerName = id => match.players.find(player => player.id === id)?.name || 'Player';
    const face = (player, fallback) => escape(player.avatar || fallback);
    const votes = [];
    let phase = 'role-pass';
    let roleIndex = 0;
    let voteIndex = 0;
    let timer = null;
    let remaining = duration * 1000;
    let deadline = 0;
    let lastTick = null;
    let paused = false;
    let destroyed = false;
    let resolution = null;
    let winner = null;
    let resultReason = '';

    function sound(cue) {
      if (destroyed) return;
      try { options.onSound?.(cue); } catch { /* Audio is optional; the game still works. */ }
    }
    function stopTimer() { if (timer !== null) { host.clearInterval(timer); timer = null; } }
    function title(kicker, heading, description = '') {
      return `<div class="imposter-heading"><span class="section-kicker">${escape(kicker)}</span><h2 id="dialog-title">${escape(heading)}</h2>${description ? `<p class="muted">${escape(description)}</p>` : ''}</div>`;
    }
    function button(action, label, primary = true) {
      return `<button type="button" class="button ${primary ? 'button-dark' : 'button-outline'}" data-imposter-action="${action}">${escape(label)}</button>`;
    }
    function focusHeading() {
      const heading = container.querySelector('#dialog-title');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
    function render() {
      if (destroyed) return;
      let markup = '';
      if (phase === 'role-pass') {
        const player = match.players[roleIndex];
        markup = title(`SECRET ROLES · ${roleIndex + 1} OF ${match.players.length}`, `Pass to ${player.name}`, 'Everyone else, look away. Only this player should see the next screen.') +
          `<div class="imposter-private-card"><span class="imposter-symbol imposter-face" aria-hidden="true">${face(player, '◈')}</span><h3>Your role is hidden.</h3><p>Hold the screen close. Don’t read your role aloud.</p></div>` +
          `<div class="dialog-actions">${button('reveal-role', 'I’m ready · show my role')}</div>`;
      } else if (phase === 'role-reveal') {
        const player = match.players[roleIndex];
        const imposter = player.id === match.imposterId;
        markup = title('FOR YOUR EYES ONLY', player.name) +
          `<div class="imposter-private-card ${imposter ? 'imposter-secret' : 'imposter-word'}"><span class="imposter-emote" aria-hidden="true">${imposter ? '😈' : '🤫'}</span><span class="prompt-label">${imposter ? 'YOUR ROLE' : 'YOU KNOW THE SECRET WORD'}</span><div class="prompt-text">${imposter ? 'You are the imposter' : escape(match.word)}</div><p>${imposter ? 'You don’t know the word. Listen, blend in, and give a believable clue.' : 'Remember the word. Give a subtle clue later, but don’t reveal it.'}</p><span class="imposter-category">Category: ${escape(match.category)}</span></div>` +
          `<div class="dialog-actions">${button('hide-role', roleIndex === match.players.length - 1 ? 'Hide my role & continue' : 'Hide my role & pass')}</div>`;
      } else if (phase === 'discussion-ready') {
        markup = title('EVERYONE HAS A SECRET', 'Let the clues begin.', 'One of you is bluffing. Can you work out who?') +
          `<div class="imposter-private-card"><h3>${escape(playerName(match.firstSpeakerId))} gives the first clue.</h3><p>Go around the group with one short clue each. Then ask questions and compare stories. Never say the secret word aloud.</p><p>When discussion ends, everyone casts one private vote. A caught imposter gets one final guess at the word.</p></div>` +
          `<div class="dialog-actions">${button('start-discussion', `Start ${duration / 60}-minute discussion`)}</div>`;
      } else if (phase === 'discussion') {
        markup = title('TRUST YOUR INSTINCTS', paused ? 'Discussion paused.' : 'Who’s bluffing?', paused ? 'Resume when everyone is ready.' : 'Give clues, ask questions, and keep the secret word to yourself.') +
          '<div class="imposter-clock" role="timer" aria-label="Discussion time remaining"></div><div class="timer-bar"><div class="timer-fill" data-imposter-timer></div></div>' +
          `<p class="imposter-table-note">${escape(playerName(match.firstSpeakerId))} starts the clues. All ${match.players.length} players get a private vote.</p>` +
          `<div class="dialog-actions">${button('pause-discussion', paused ? 'Resume discussion' : 'Pause', false)}${button('start-voting', 'Ready to vote')}</div>`;
      } else if (phase === 'vote-pass') {
        const player = match.players[voteIndex];
        markup = title(`PRIVATE VOTE · ${voteIndex + 1} OF ${match.players.length}`, `Pass to ${player.name}`, 'Everyone else, look away. Your vote is yours alone.') +
          `<div class="imposter-private-card"><span class="imposter-symbol imposter-face" aria-hidden="true">${face(player, '◇')}</span><h3>Keep your choice secret.</h3><p>Vote for the person you think is the imposter. No voting for yourself.</p></div>` +
          `<div class="dialog-actions">${button('reveal-vote', 'I’m ready to vote')}</div>`;
      } else if (phase === 'vote-open') {
        const player = match.players[voteIndex];
        markup = title('YOUR PRIVATE VOTE', `${player.name}, who is it?`, 'Choose carefully. Your vote locks in when you tap a name.') +
          `<div class="imposter-vote-grid">${match.players.filter(candidate => candidate.id !== player.id).map(candidate => `<button type="button" class="button button-outline" data-imposter-vote="${escape(candidate.id)}">${candidate.avatar ? `<span class="imposter-vote-face" aria-hidden="true">${escape(candidate.avatar)}</span>` : ''}${escape(candidate.name)}</button>`).join('')}</div>`;
      } else if (phase === 'vote-receipt') {
        markup = title('VOTE LOCKED IN', 'Your secret is safe.', 'Your choice stays hidden until everyone has voted.') +
          '<div class="imposter-private-card"><span class="imposter-symbol" aria-hidden="true">✓</span><h3>Don’t give anything away.</h3><p>Hide this screen before handing over the device.</p></div>' +
          `<div class="dialog-actions">${button('hide-vote', voteIndex === match.players.length - 1 ? 'All votes are in · reveal the result' : 'Hide & pass to the next voter')}</div>`;
      } else if (phase === 'last-guess') {
        markup = title('THE GROUP FOUND THE IMPOSTER', `${playerName(match.imposterId)}, one last chance.`, 'You were caught! Guess the secret word correctly to steal the win. Everyone else: no hints.') +
          `<form class="imposter-guess-form"><label for="imposter-guess">What was the secret word?</label><input id="imposter-guess" name="guess" type="text" maxlength="100" autocomplete="off" spellcheck="false" placeholder="Your one final guess" required><p class="field-hint">Capital letters, accents, spaces, and punctuation don’t matter.</p><p class="imposter-error" role="status"></p><div class="dialog-actions">${button('forfeit-guess', 'I don’t know', false)}<button type="submit" class="button button-dark">Lock in my guess</button></div></form>`;
      } else if (phase === 'result') {
        const headline = resolution.outcome === 'tie' ? 'No consensus. Imposter escaped.' : winner === 'group' ? 'The group wins!' : 'The imposter wins!';
        const emote = resolution.outcome === 'tie' ? '🤷' : winner === 'group' ? '🎉' : '😈';
        markup = `<div class="tv-emote" aria-hidden="true">${emote}</div>` + title('THE TRUTH COMES OUT', headline, resultReason) +
          `<div class="imposter-result-card"><span class="section-kicker">THE IMPOSTER WAS</span><h3>${face(match.players.find(player => player.id === match.imposterId), '')} ${escape(playerName(match.imposterId))}</h3><span class="section-kicker">THE SECRET WORD WAS</span><p class="prompt-text">${escape(match.word)}</p></div><div class="imposter-tallies"><h3>The final vote</h3>${resolution.counts.slice().sort((a, b) => b.count - a.count).map(row => `<div class="imposter-tally"><span>${escape(playerName(row.id))}${row.id === match.imposterId ? ' <span class="imposter-role-tag">IMPOSTER</span>' : ''}</span><strong>${row.count} ${row.count === 1 ? 'vote' : 'votes'}</strong></div>`).join('')}</div><p class="imposter-table-note">This is a group game. Team scores stay as they are.</p>` +
          `<div class="dialog-actions">${button('close', 'Pick another game', false)}${button('replay', 'New secret · play again')}</div>`;
      }
      // Reactions only appear on the shared screens, never while someone is looking at a secret.
      const shared = ['discussion-ready', 'discussion', 'result'].includes(phase);
      container.innerHTML = `<section class="imposter-game tv-show" data-imposter-phase="${phase}"><div class="tv-marquee" aria-hidden="true">${'<i></i>'.repeat(22)}</div>${markup}${shared ? options.reactions || '' : ''}</section>`;
      if (phase === 'discussion') updateClock();
      focusHeading();
    }
    function updateClock() {
      const clock = container.querySelector('.imposter-clock');
      if (!clock) return;
      const seconds = Math.ceil(remaining / 1000);
      clock.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      clock.classList.toggle('urgent', seconds <= 10);
      const bar = container.querySelector('[data-imposter-timer]');
      if (bar) bar.style.width = `${Math.max(0, remaining / (duration * 1000) * 100)}%`;
    }
    function beginVoting() {
      if (destroyed || phase !== 'discussion') return;
      stopTimer();
      phase = 'vote-pass';
      voteIndex = 0;
      sound('finish');
      render();
    }
    function tick() {
      if (destroyed || phase !== 'discussion' || paused) return;
      remaining = Math.max(0, deadline - host.performance.now());
      updateClock();
      const seconds = Math.ceil(remaining / 1000);
      if (seconds > 0 && seconds <= 5 && seconds !== lastTick) { lastTick = seconds; sound('tick'); }
      if (remaining === 0) beginVoting();
    }
    function showResult(nextWinner, reason) {
      winner = nextWinner;
      resultReason = reason;
      phase = 'result';
      sound(winner === 'group' ? 'correct' : 'wrong');
      render();
    }
    function countVotes() {
      resolution = resolveVotes(match, votes);
      if (resolution.outcome === 'tie') showResult('imposter', 'The top vote was tied, so nobody was caught.');
      else if (resolution.outcome === 'innocent-accused') showResult('imposter', `The group accused ${playerName(resolution.accusedId)}, who knew the word.`);
      else { phase = 'last-guess'; sound('reveal'); render(); }
    }
    function onClick(event) {
      if (destroyed) return;
      const voteButton = event.target.closest('[data-imposter-vote]');
      if (voteButton && phase === 'vote-open') {
        const voter = match.players[voteIndex];
        const targetId = voteButton.dataset.imposterVote;
        if (targetId === voter.id || !match.players.some(player => player.id === targetId)) return;
        votes.push({ voterId: voter.id, targetId });
        phase = 'vote-receipt';
        sound('reveal');
        render();
        return;
      }
      const action = event.target.closest('[data-imposter-action]')?.dataset.imposterAction;
      if (action === 'reveal-role' && phase === 'role-pass') { phase = 'role-reveal'; sound('reveal'); render(); }
      else if (action === 'hide-role' && phase === 'role-reveal') { roleIndex += 1; phase = roleIndex === match.players.length ? 'discussion-ready' : 'role-pass'; render(); }
      else if (action === 'start-discussion' && phase === 'discussion-ready') {
        phase = 'discussion';
        paused = false;
        deadline = host.performance.now() + remaining;
        timer = host.setInterval(tick, 100);
        sound('start');
        render();
      } else if (action === 'pause-discussion' && phase === 'discussion') {
        if (!paused) { tick(); if (phase !== 'discussion') return; paused = true; }
        else { paused = false; deadline = host.performance.now() + remaining; }
        render();
      } else if (action === 'start-voting' && phase === 'discussion') beginVoting();
      else if (action === 'reveal-vote' && phase === 'vote-pass') { phase = 'vote-open'; render(); }
      else if (action === 'hide-vote' && phase === 'vote-receipt') {
        voteIndex += 1;
        if (voteIndex === match.players.length) countVotes();
        else { phase = 'vote-pass'; render(); }
      } else if (action === 'forfeit-guess' && phase === 'last-guess') showResult('group', 'The imposter was caught and could not name the secret word.');
      else if (action === 'close' && phase === 'result') { destroy(); options.onClose?.(); }
      else if (action === 'replay' && phase === 'result') { destroy(); options.onReplay?.(); }
    }
    function onSubmit(event) {
      if (!event.target.matches('.imposter-guess-form')) return;
      event.preventDefault();
      if (destroyed || phase !== 'last-guess') return;
      const input = container.querySelector('#imposter-guess');
      const guess = normalizeGuess(input.value);
      if (!guess) { container.querySelector('.imposter-error').textContent = 'Type a word, or choose “I don’t know”.'; input.focus(); return; }
      if (guess === normalizeGuess(match.word)) showResult('imposter', 'Caught, but not beaten! The imposter guessed the secret word.');
      else showResult('group', 'The imposter was caught and their final guess missed the mark.');
    }
    function handleVisibility(hidden) {
      if (destroyed || !hidden) return;
      if (phase === 'role-reveal') { phase = 'role-pass'; render(); }
      else if (phase === 'vote-open') { phase = 'vote-pass'; render(); }
      else if (phase === 'discussion' && !paused) { tick(); if (phase === 'discussion') { paused = true; render(); } }
      else if (phase === 'last-guess') render();
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      stopTimer();
      container.removeEventListener('click', onClick);
      container.removeEventListener('submit', onSubmit);
      container.replaceChildren();
      match.word = '';
      match.imposterId = '';
      votes.length = 0;
    }
    container.addEventListener('click', onClick);
    container.addEventListener('submit', onSubmit);
    render();
    return Object.freeze({ destroy, handleVisibility });
  }

  return Object.freeze({ createMatch, resolveVotes, normalizeGuess, create });
});
