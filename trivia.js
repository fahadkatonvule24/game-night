(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GameNightTrivia = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LEVELS = ['easy', 'medium', 'hard'];
  const QUESTIONS_PER_LEVEL = 10;
  const HALFTIME_AFTER = 5;
  const HUDDLE_SECONDS = 120;
  const LEVEL_POINTS = Object.freeze({ easy: 1, medium: 2, hard: 3 });
  const DURATIONS = [15, 30, 60, 90, 120];
  // A short drum-roll pause between locking in an answer and the reveal.
  const REVEAL_DELAY = 900;
  const TILE_COLORS = ['tile-a', 'tile-b', 'tile-c', 'tile-d'];

  const levelName = level => level.charAt(0).toUpperCase() + level.slice(1);
  const plural = (count, word) => `${count} ${count === 1 ? word : `${word}s`}`;

  function randomIndex(length, rng) {
    const value = rng();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('The random source must return a number from 0 up to 1.');
    return Math.floor(value * length);
  }

  // Deals each question at most once per game. A thin category borrows from the
  // same level first, then the same category, and only repeats once all are used.
  function createQuestionBank(prompts, category = 'all', rng = Math.random) {
    const questions = (Array.isArray(prompts) ? prompts : []).filter(p => p && typeof p.text === 'string' && Array.isArray(p.options) && p.options.length === 4 && Number.isInteger(p.answer) && p.answer >= 0 && p.answer < 4);
    if (!questions.length) throw new RangeError('Trivia needs at least one question.');
    const used = new Set();
    const inCategory = p => category === 'all' || p.category === category;
    function draw(level) {
      const tiers = [p => inCategory(p) && p.difficulty === level, p => p.difficulty === level, inCategory, () => true];
      for (const tier of tiers) {
        const pool = questions.filter(p => tier(p) && !used.has(p.text));
        if (!pool.length) continue;
        const question = pool[randomIndex(pool.length, rng)];
        used.add(question.text);
        // Shuffle the choices so the right answer moves around between games.
        const order = [0, 1, 2, 3];
        for (let i = 3; i > 0; i -= 1) {
          const j = randomIndex(i + 1, rng);
          [order[i], order[j]] = [order[j], order[i]];
        }
        return { text: question.text, category: question.category, difficulty: question.difficulty, options: order.map(i => question.options[i]), answer: order.indexOf(question.answer) };
      }
      used.clear();
      return draw(level);
    }
    return { draw };
  }

  function create(options) {
    if (!options?.container || typeof options.container.addEventListener !== 'function') throw new TypeError('A Trivia game container is required.');
    const { container } = options;
    const host = container.ownerDocument.defaultView;
    const rng = options.rng || Math.random;
    const teams = (options.teams || []).map((team, index) => {
      if (!team || typeof team.id !== 'string' || !Array.isArray(team.players) || !team.players.length) throw new TypeError('Every Trivia team needs at least one player.');
      return { id: team.id, name: String(team.name || `Team ${index + 1}`), color: String(team.color || '#fa7655'), players: team.players.map((p, i) => ({ id: String(p.id), name: String(p.name || `Player ${i + 1}`), avatar: typeof p.avatar === 'string' ? p.avatar : '' })) };
    });
    if (teams.length < 1) throw new RangeError('Trivia needs at least one team.');
    const levels = (options.levels || LEVELS).filter(level => LEVELS.includes(level));
    if (!levels.length) throw new RangeError('Choose at least one Trivia level.');
    const duration = options.duration === undefined ? 30 : Number(options.duration);
    if (!DURATIONS.includes(duration)) throw new RangeError('Choose 15, 30, 60, 90, or 120 seconds per question.');
    const start = Number.isInteger(options.startTeam) ? ((options.startTeam % teams.length) + teams.length) % teams.length : 0;
    const order = teams.slice(start).concat(teams.slice(0, start));
    const bank = createQuestionBank(options.prompts, options.category || 'all', rng);
    const labelFor = typeof options.categoryLabel === 'function' ? options.categoryLabel : id => id;
    const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const totals = new Map(teams.map(team => [team.id, 0]));
    let phase = 'level-intro';
    let levelIndex = 0;
    let turn = 0;
    let number = 0;
    let outcomes = [];
    let roundPoints = 0;
    let seat = null;
    let locked = false;
    let question = null;
    let selection = null;
    let remaining = 0;
    let deadline = 0;
    let revealAt = 0;
    let lastTick = null;
    let paused = false;
    let quip = '';
    let destroyed = false;
    const timer = host.setInterval(tick, 100);

    const level = () => levels[levelIndex];
    const team = () => order[turn];
    const worth = () => LEVEL_POINTS[level()];
    const seatPlayer = () => team().players.find(p => p.id === seat) || team().players[0];
    const seatName = () => seatPlayer().name;
    const avatarOf = player => escape(player.avatar || player.name.slice(0, 1).toUpperCase());
    const now = () => host.performance.now();

    function emit(name, ...args) {
      if (destroyed) return;
      try { options[name]?.(...args); } catch { /* A host callback cannot break the show. */ }
    }
    const sound = cue => emit('onSound', cue);

    function marquee() {
      return `<div class="tv-marquee" aria-hidden="true">${'<i></i>'.repeat(22)}</div>`;
    }
    function primary(action, label, extra = '') {
      return `<button type="button" class="button tv-button" data-trivia-action="${action}" data-trivia-primary ${extra}>${escape(label)} <span aria-hidden="true">↗</span></button>`;
    }
    function secondary(action, label) {
      return `<button type="button" class="button tv-button-ghost" data-trivia-action="${action}">${escape(label)}</button>`;
    }
    function levelChip(value = level()) {
      return `<span class="tv-level tv-level-${value}">${escape(levelName(value))}</span>`;
    }
    function track(marks = outcomes) {
      return `<ol class="tv-track" aria-label="Question ${Math.max(1, number)} of ${QUESTIONS_PER_LEVEL}">${Array.from({ length: QUESTIONS_PER_LEVEL }, (_, i) => {
        const state = marks[i] || (i === number - 1 && phase !== 'team-done' ? 'current' : 'upcoming');
        return `<li class="tv-dot tv-dot-${state}${i === HALFTIME_AFTER - 1 ? ' tv-half' : ''}"><span class="sr-only">Question ${i + 1}: ${state}</span></li>`;
      }).join('')}</ol>`;
    }
    function seatPicker(heading) {
      const current = team();
      if (current.players.length < 2) return `<p class="tv-note">${escape(current.players[0].name)} is flying solo for ${escape(current.name)}.</p>`;
      return `<h3 class="tv-seat-heading">${escape(heading)}</h3><div class="tv-seats" role="group" aria-label="${escape(heading)}">${current.players.map((p, i) => `<button type="button" class="tv-seat${p.id === seat ? ' is-up' : ''}" data-trivia-player="${escape(p.id)}" aria-pressed="${p.id === seat}" style="--i:${i}"><span class="tv-avatar" aria-hidden="true">${avatarOf(p)}</span>${escape(p.name)}</button>`).join('')}</div>`;
    }
    // The hot-seat player's face reacts to how the question is going.
    function mood() {
      if (phase === 'question') return paused ? ['😴', 'resting'] : Math.ceil(remaining / 1000) <= 5 ? ['😰', 'sweating'] : ['🤔', 'thinking'];
      if (phase === 'locking') return ['😬', 'nervous'];
      if (phase === 'reveal') {
        const result = outcomes[number - 1];
        if (result === 'right') return number >= 3 && outcomes.slice(number - 3, number).every(o => o === 'right') ? ['😎', 'on a roll'] : ['🤩', 'thrilled'];
        return { wrong: ['😭', 'gutted'], timeout: ['😱', 'out of time'], passed: ['🤷', 'passing'] }[result];
      }
      if (phase === 'huddle') return ['🗣️', 'huddling'];
      return ['😃', 'ready'];
    }
    function face() {
      const [emoji, feeling] = mood();
      return `<span class="tv-face"><span class="tv-face-emoji" aria-hidden="true">${avatarOf(seatPlayer())}</span><i class="tv-mood" data-trivia-mood role="img" aria-label="${escape(seatName())} is ${feeling}">${emoji}</i></span>`;
    }
    function hud() {
      const current = team();
      return `<header class="tv-hud" style="--team:${escape(current.color)}"><div class="tv-hud-team">${face()}<div><strong>${escape(current.name)}</strong><small>${escape(seatName())} ${locked ? '<span class="tv-lock">🔒 locked in</span>' : 'in the hot seat'}</small></div></div><div class="tv-hud-level">${levelChip()}<small>LEVEL ${levelIndex + 1} OF ${levels.length}</small></div><div class="tv-hud-score"><b>${roundPoints}</b><small>${roundPoints === 1 ? 'POINT' : 'POINTS'}</small></div></header>${track()}`;
    }
    function standings() {
      const ranked = [...teams].sort((a, b) => totals.get(b.id) - totals.get(a.id));
      const top = Math.max(1, totals.get(ranked[0].id));
      return `<ol class="tv-standings">${ranked.map((t, i) => `<li style="--team:${escape(t.color)};--share:${(totals.get(t.id) / top).toFixed(3)};--i:${i}"><span class="tv-rank">${teams.filter(other => totals.get(other.id) > totals.get(t.id)).length + 1}</span><span class="tv-standing-name">${escape(t.name)}</span><span class="tv-bar"><i></i></span><b>${plural(totals.get(t.id), 'pt')}</b></li>`).join('')}</ol>`;
    }
    function leaders() {
      const best = Math.max(...totals.values());
      return teams.filter(t => totals.get(t.id) === best);
    }

    function render() {
      if (destroyed) return;
      const current = team();
      let markup = '';
      if (phase === 'level-intro') {
        markup = `<div class="tv-card tv-level-intro"><span class="tv-kicker">TRIVIA NIGHT · ${levelIndex ? 'NEXT UP' : 'TONIGHT’S SHOW'}</span><h2 id="dialog-title" class="tv-title">Level ${levelIndex + 1}</h2><div class="tv-stamp tv-level-${level()}">${escape(levelName(level()))}</div><p class="tv-lede">Every team gets its own round of ${QUESTIONS_PER_LEVEL} questions. Each right answer is worth <strong>${plural(worth(), 'point')}</strong>. Halftime huddle after question ${HALFTIME_AFTER}.</p><ol class="tv-lineup">${order.map((t, i) => `<li style="--team:${escape(t.color)};--i:${i}"><i class="tv-team-dot" aria-hidden="true"></i>${escape(t.name)}${levelIndex ? `<b>${plural(totals.get(t.id), 'pt')}</b>` : ''}</li>`).join('')}</ol><div class="dialog-actions">${primary('begin-level', `Bring on ${order[0].name}`)}</div></div>`;
      } else if (phase === 'team-intro') {
        markup = `<div class="tv-card tv-team-intro" style="--team:${escape(current.color)}"><div class="tv-spotlight" aria-hidden="true"></div><span class="tv-kicker">LEVEL ${levelIndex + 1} · ${escape(levelName(level()).toUpperCase())} · TEAM ${turn + 1} OF ${order.length}</span><h2 id="dialog-title" class="tv-team-name">${escape(current.name)}</h2><p class="tv-lede">step into the spotlight!</p>${seatPicker('Who’s in the hot seat?')}<p class="tv-note">The player in the hot seat answers. Teammates can cheer, but no hints! You can swap at halftime.</p><div class="dialog-actions">${primary('start-team', `Lights up · ${seatName()} plays`)}</div></div>`;
      } else if (['question', 'locking', 'reveal'].includes(phase)) {
        const revealed = phase === 'reveal';
        const tiles = question.options.map((option, i) => {
          let state = '';
          if (phase === 'locking') state = i === selection ? ' is-locked' : ' is-waiting';
          if (revealed) state = i === question.answer ? ' is-correct' : i === selection ? ' is-wrong' : ' is-out';
          return `<button type="button" class="tv-tile ${TILE_COLORS[i]}${state}" data-trivia-answer="${i}" style="--i:${i}" ${phase === 'question' && !paused ? '' : 'disabled'}><span class="tv-tile-letter">${'ABCD'[i]}</span><span class="tv-tile-text">${escape(option)}</span>${revealed && i === question.answer ? '<span class="tv-tile-mark" aria-hidden="true">✓</span>' : revealed && i === selection ? '<span class="tv-tile-mark" aria-hidden="true">✕</span>' : ''}</button>`;
        }).join('');
        const right = selection === question.answer;
        const feedback = !revealed ? '' : `<div class="tv-verdict ${right ? 'tv-verdict-right' : 'tv-verdict-miss'}" role="status">${right ? `<span class="tv-pop" aria-hidden="true">+${worth()}</span><strong>Correct!</strong> ${escape(seatName())} nails it. +${plural(worth(), 'point')}.` : `<strong>${selection === -1 ? 'Time’s up!' : selection === -2 ? 'Passed.' : 'Oh no!'}</strong> The answer was <strong>${escape(question.options[question.answer])}</strong>.`}${quip ? `<span class="tv-quip-line">💬 ${escape(quip)}</span>` : ''}</div>`;
        const nextLabel = number === QUESTIONS_PER_LEVEL ? 'See how you did' : number === HALFTIME_AFTER ? 'Halftime huddle' : `Question ${number + 1}`;
        const controls = revealed ? primary('next-question', nextLabel)
          : phase === 'locking' ? '<p class="tv-locking-text" role="status">Locking it in…</p>'
          : `${secondary('pause', paused ? 'Resume' : 'Pause')}${secondary('skip', 'Pass')}`;
        markup = `<h2 id="dialog-title" class="sr-only">${escape(current.name)}, question ${number} of ${QUESTIONS_PER_LEVEL}</h2>${hud()}<div class="tv-stage"><div class="tv-clock${phase !== 'question' ? ' is-stopped' : ''}" data-trivia-clock role="timer" aria-label="Time left"><span></span></div><div class="tv-question${paused ? ' is-paused' : ''}" data-question="${number}"><span class="tv-question-meta">QUESTION ${number} OF ${QUESTIONS_PER_LEVEL} · ${escape(labelFor(question.category))} · ${plural(worth(), 'pt')}</span><h3 class="tv-question-text">${paused ? 'Paused · no peeking!' : escape(question.text)}</h3></div></div>${paused ? '' : `<div class="tv-tiles">${tiles}</div>`}${feedback}<div class="dialog-actions tv-actions">${controls}</div>${keyHint()}`;
      } else if (phase === 'huddle') {
        markup = `${hud()}<div class="tv-card tv-huddle"><span class="tv-kicker">HALFTIME HUDDLE · ${HALFTIME_AFTER} DOWN, ${QUESTIONS_PER_LEVEL - HALFTIME_AFTER} TO GO</span><h2 id="dialog-title" class="tv-title tv-title-small">${team().players.length > 1 ? 'Change who’s up?' : 'Catch your breath.'}</h2><p class="tv-lede">${escape(current.name)} has <strong>${plural(roundPoints, 'point')}</strong> so far. Talk it over: pick a teammate for the hot seat, or keep ${escape(seatName())}. When the 2 minutes are up, whoever is up must finish the round.</p><div class="tv-clock tv-clock-big" data-trivia-clock role="timer" aria-label="Huddle time left"><span></span></div>${seatPicker('Pick who’s up for questions 6–10')}<div class="dialog-actions">${primary('end-huddle', `Lock in ${seatName()} · question ${HALFTIME_AFTER + 1}`)}</div>${keyHint()}</div>`;
      } else if (phase === 'team-done') {
        const right = outcomes.filter(o => o === 'right').length;
        const heading = right === QUESTIONS_PER_LEVEL ? 'A perfect round!' : right >= 7 ? 'Brilliant round!' : right >= 4 ? 'Solid round.' : right ? 'Tough crowd.' : 'The next one’s yours.';
        const next = order[turn + 1];
        const emote = right === QUESTIONS_PER_LEVEL ? '🏆' : right >= 7 ? '😎' : right >= 4 ? '🙂' : right ? '😅' : '🙈';
        markup = `<div class="tv-card tv-team-done" style="--team:${escape(current.color)}"><div class="tv-emote" aria-hidden="true">${emote}</div><span class="tv-kicker">${escape(current.name.toUpperCase())} · LEVEL ${levelIndex + 1} COMPLETE</span><h2 id="dialog-title" class="tv-title tv-title-small">${escape(heading)}</h2><div class="tv-big-score">+${roundPoints}</div><p class="tv-lede">${right} of ${QUESTIONS_PER_LEVEL} right on ${escape(levelName(level()))}. ${escape(current.name)} has ${plural(totals.get(current.id), 'point')} this game.</p>${track()}<div class="dialog-actions">${primary('next-team', next ? `Up next: ${next.name}` : 'Level standings')}</div></div>`;
      } else if (phase === 'level-done') {
        const top = leaders();
        const last = levelIndex === levels.length - 1;
        markup = `<div class="tv-card tv-level-done"><span class="tv-kicker">LEVEL ${levelIndex + 1} · ${escape(levelName(level()).toUpperCase())} COMPLETE</span><h2 id="dialog-title" class="tv-title tv-title-small">${totals.get(top[0].id) === 0 ? 'Nobody’s on the board yet!' : top.length > 1 ? 'Neck and neck!' : `${escape(top[0].name)} leads the way!`}</h2>${standings()}<div class="dialog-actions">${primary('next-level', last ? 'The final results' : `On to Level ${levelIndex + 2} · ${levelName(levels[levelIndex + 1])}`)}</div></div>`;
      } else if (phase === 'final') {
        const top = leaders();
        const best = totals.get(top[0].id);
        const heading = best === 0 ? 'Nobody scored. Rematch?' : top.length > 1 ? `It’s a tie between ${top.map(t => t.name).join(' and ')}!` : `${top[0].name} wins Trivia Night!`;
        markup = `<div class="tv-card tv-final"><span class="tv-kicker">AND THE TRIVIA CHAMPION IS…</span><div class="tv-trophy" aria-hidden="true">🏆</div><h2 id="dialog-title" class="tv-title tv-title-small">${escape(heading)}</h2>${standings()}<p class="tv-note">Every point is already on the scoreboard.</p><div class="dialog-actions">${secondary('close', 'Pick another game')}${primary('replay', 'Play again')}</div></div>`;
      }
      container.innerHTML = `<section class="tv-show" data-trivia-phase="${phase}">${marquee()}${markup}${options.reactions || ''}</section>`;
      updateClock();
      const heading = container.querySelector('#dialog-title');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
    function keyHint() {
      const key = (k, label) => `<span><kbd>${k}</kbd> ${label}</span>`;
      const keys = phase === 'question' ? (paused ? [key('P', 'resume')] : [key('A–D', 'answer'), key('S', 'pass'), key('P', 'pause')]) : phase === 'reveal' || phase === 'huddle' ? [key('N', 'next')] : [];
      return keys.length ? `<p class="shortcut-hint tv-keys">Host keys ${keys.join('')}</p>` : '';
    }
    function updateClock() {
      const clock = container.querySelector('[data-trivia-clock]');
      if (!clock) return;
      const total = phase === 'huddle' ? HUDDLE_SECONDS : duration;
      const seconds = Math.ceil(remaining / 1000);
      clock.querySelector('span').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      clock.style.setProperty('--p', Math.max(0, Math.min(1, remaining / (total * 1000))).toFixed(3));
      clock.classList.toggle('is-urgent', seconds <= (phase === 'huddle' ? 10 : 5) && phase !== 'reveal');
      const moodBadge = container.querySelector('[data-trivia-mood]');
      const [emoji] = mood();
      if (moodBadge && moodBadge.textContent !== emoji) { moodBadge.textContent = emoji; moodBadge.classList.remove('is-new'); void moodBadge.offsetWidth; moodBadge.classList.add('is-new'); }
    }

    function askQuestion() {
      number += 1;
      question = bank.draw(level());
      selection = null;
      paused = false;
      remaining = duration * 1000;
      deadline = now() + remaining;
      lastTick = null;
      phase = 'question';
      sound('reveal');
      render();
    }
    function reveal(choice) {
      selection = choice;
      const right = choice === question.answer;
      outcomes[number - 1] = right ? 'right' : choice === -1 ? 'timeout' : choice === -2 ? 'passed' : 'wrong';
      phase = 'reveal';
      if (right) {
        roundPoints += worth();
        totals.set(team().id, totals.get(team().id) + worth());
        emit('onScore', team().id, worth());
        sound('correct');
      } else sound(choice === -1 ? 'buzzer' : choice === -2 ? 'skip' : 'wrong');
      // The host chimes in automatically: a one-liner plus emojis that match the result.
      const streak = right && number >= 3 && outcomes.slice(number - 3, number).every(o => o === 'right');
      const kind = streak ? 'streak' : right ? 'right' : { timeout: 'timeout', passed: 'skip', wrong: 'wrong' }[outcomes[number - 1]];
      quip = typeof options.quip === 'function' ? String(options.quip(kind, seatName()) || '') : '';
      render();
      emit('onOutcome', kind);
      if (streak) emit('onCelebrate', 50);
    }
    function answer(choice) {
      if (phase !== 'question' || paused || !(choice >= 0 && choice < 4)) return;
      tick();
      if (phase !== 'question') return;
      selection = choice;
      phase = 'locking';
      revealAt = now() + REVEAL_DELAY;
      sound('lockin');
      render();
    }
    function startHuddle() {
      phase = 'huddle';
      remaining = HUDDLE_SECONDS * 1000;
      deadline = now() + remaining;
      lastTick = null;
      sound('whistle');
      render();
    }
    function endHuddle(auto) {
      if (phase !== 'huddle') return;
      locked = true;
      emit('onNotice', auto ? `Time! ${seatName()} must finish the round.` : `${seatName()} is locked in for the rest of the round.`);
      askQuestion();
    }
    function finishTeam() {
      phase = 'team-done';
      const right = outcomes.filter(o => o === 'right').length;
      sound(right === QUESTIONS_PER_LEVEL ? 'champion' : 'finish');
      emit('onTeamDone', team().id, roundPoints, level());
      render();
      if (right >= 7) emit('onCelebrate', right === QUESTIONS_PER_LEVEL ? 180 : 90);
    }
    function introduceTeam() {
      const current = team();
      seat = current.players[levelIndex % current.players.length].id;
      locked = false;
      number = 0;
      outcomes = [];
      roundPoints = 0;
      phase = 'team-intro';
      sound('spotlight');
      render();
    }
    function tick() {
      if (destroyed) return;
      if (phase === 'locking') { if (now() >= revealAt) reveal(selection); return; }
      if (!['question', 'huddle'].includes(phase) || paused) return;
      remaining = Math.max(0, deadline - now());
      updateClock();
      const seconds = Math.ceil(remaining / 1000);
      if (seconds > 0 && seconds <= 5 && seconds !== lastTick) { lastTick = seconds; sound('tick'); }
      if (remaining > 0) return;
      if (phase === 'question') reveal(-1);
      else endHuddle(true);
    }
    function togglePause() {
      if (phase !== 'question') return;
      if (!paused) { tick(); if (phase !== 'question') return; paused = true; }
      else { paused = false; deadline = now() + remaining; }
      render();
    }
    function act(action) {
      if (action === 'begin-level' && phase === 'level-intro') introduceTeam();
      else if (action === 'start-team' && phase === 'team-intro') { sound('start'); askQuestion(); }
      else if (action === 'pause') togglePause();
      else if (action === 'skip' && phase === 'question' && !paused) { tick(); if (phase === 'question') reveal(-2); }
      else if (action === 'next-question' && phase === 'reveal') {
        if (number === QUESTIONS_PER_LEVEL) finishTeam();
        else if (number === HALFTIME_AFTER) startHuddle();
        else askQuestion();
      } else if (action === 'end-huddle') endHuddle(false);
      else if (action === 'next-team' && phase === 'team-done') {
        if (turn < order.length - 1) { turn += 1; introduceTeam(); }
        else { phase = 'level-done'; sound('levelup'); render(); }
      } else if (action === 'next-level' && phase === 'level-done') {
        if (levelIndex < levels.length - 1) { levelIndex += 1; turn = 0; phase = 'level-intro'; sound('levelup'); render(); emit('onCelebrate', 60); }
        else {
          phase = 'final';
          sound('champion');
          render();
          if (Math.max(...totals.values()) > 0) emit('onCelebrate', 200);
        }
      } else if (action === 'close' && phase === 'final') { const done = options.onClose; destroy(); done?.(); }
      else if (action === 'replay' && phase === 'final') { const again = options.onReplay; destroy(); again?.(); }
    }
    function pickPlayer(id) {
      if (!['team-intro', 'huddle'].includes(phase) || locked || seat === id || !team().players.some(p => p.id === id)) return;
      seat = id;
      sound('skip');
      // Keep the huddle clock running while the screen redraws.
      if (phase === 'huddle') tick();
      if (['team-intro', 'huddle'].includes(phase)) render();
    }
    function onClick(event) {
      if (destroyed) return;
      const tile = event.target.closest('[data-trivia-answer]');
      if (tile) { answer(Number(tile.dataset.triviaAnswer)); return; }
      const player = event.target.closest('[data-trivia-player]');
      if (player) { pickPlayer(player.dataset.triviaPlayer); return; }
      const action = event.target.closest('[data-trivia-action]')?.dataset.triviaAction;
      if (action) act(action);
    }
    // Keys only press what a tap could, so they never skip ahead of the show.
    function handleKey(key) {
      if (destroyed) return false;
      const lower = String(key).toLowerCase();
      const letter = 'abcd'.indexOf(lower);
      let target = null;
      if (phase === 'question' && lower.length === 1 && letter >= 0) target = container.querySelector(`[data-trivia-answer="${letter}"]:not(:disabled)`);
      else if (lower === 's') target = phase === 'question' ? container.querySelector('[data-trivia-action="skip"]') : null;
      else if (lower === 'p') target = container.querySelector('[data-trivia-action="pause"]');
      else if (['n', 'arrowright'].includes(lower) && phase !== 'question') target = container.querySelector('[data-trivia-primary]');
      if (!target) return false;
      target.click();
      return true;
    }
    function handleVisibility(hidden) {
      if (!destroyed && hidden && phase === 'question' && !paused) togglePause();
    }
    // What a mid-round exit leaves behind, so the host can log the partial round.
    function current() {
      const inRound = ['question', 'locking', 'reveal', 'huddle'].includes(phase);
      return { phase, teamId: team().id, points: inRound ? roundPoints : 0, inRound, level: level(), totals: Object.fromEntries(totals) };
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      host.clearInterval(timer);
      container.removeEventListener('click', onClick);
      container.replaceChildren();
    }
    container.addEventListener('click', onClick);
    render();
    sound('levelup');
    return Object.freeze({ destroy, handleKey, handleVisibility, current });
  }

  return Object.freeze({ LEVELS, QUESTIONS_PER_LEVEL, HALFTIME_AFTER, HUDDLE_SECONDS, LEVEL_POINTS, createQuestionBank, create });
});
