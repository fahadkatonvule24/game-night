(() => {
  'use strict';
  const { GAMES, TEAM_PALETTE, LEVELS, shuffle, createTeams, createDeck, getGame, getCategories, categoryLabel } = window.GameNightCore;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const STORAGE_KEY = 'game-night-v1';
  const avatarColors = ['#f5dacb', '#e1eabd', '#e3daf0', '#d4e5e9', '#f1e6bb', '#efd8e3'];
  const symbols = ['✳', '✿', '✦', '≈', '☀', '♡', '◇', '✺'];
  const modes = ['auto', 'easy', 'medium', 'hard'];
  const performerGames = ['charades', 'taboo', 'quickdraw', 'who-am-i'];
  const houseGames = ['charades', 'who-am-i', 'imposter'];
  const STREAK_MILESTONES = [3, 5, 10, 15, 20];
  // Every seat gets its own face. Tap a face on the guest list to change it.
  const AVATARS = ['🦁', '🐯', '🦊', '🐼', '🐸', '🐵', '🐨', '🦄', '🐙', '🦉', '🐧', '🐢', '🦒', '🐘', '🦓', '🦩', '🐬', '🦋', '🐝', '🐞', '🦔', '🦦', '🦥', '🐺', '🐻', '🐰', '🐱', '🐶', '🐮', '🐷', '🐔', '🦜', '🦈', '🐳', '🦀', '🐌', '🦖', '🐲', '🦚', '🐿️'];
  const REACTIONS = [['👏', 'Applause'], ['😂', 'So funny'], ['😱', 'No way'], ['🔥', 'On fire'], ['🤯', 'Mind blown'], ['😍', 'Love it']];
  const reactionsMarkup = `<div class="tv-reactions" role="group" aria-label="Send a reaction">${REACTIONS.map(([emoji, label]) => `<button type="button" data-react="${emoji}" aria-label="${label}">${emoji}</button>`).join('')}</div>`;
  const marquee = `<div class="tv-marquee" aria-hidden="true">${'<i></i>'.repeat(22)}</div>`;
  const roles = {
    charades: { ask: 'Who’s acting?', verb: 'acts', note: name => `Only ${name} looks at the screen. No talking, no sound effects!` },
    taboo: { ask: 'Who’s giving clues?', verb: 'gives clues', note: name => `Only ${name} sees the word and the banned words.` },
    quickdraw: { ask: 'Who’s drawing?', verb: 'draws', note: name => `Grab a pen and paper. Only ${name} sees the prompt.` },
    'who-am-i': { ask: 'Who’s guessing?', verb: 'guesses', note: name => `${name} holds the screen to their forehead, no peeking. Team: describe it!` },
    'five-second': { ask: 'Who’s answering?', verb: 'answers', note: name => `${name} names three things before the buzzer.` },
    'emoji-decode': { ask: 'Who’s holding the answers?', verb: 'checks answers', note: name => `${name} holds the screen. Only ${name} peeks at the answer. Everyone else, shout your guesses!` }
  };
  // Every team plays one turn per level. Harder levels are worth more.
  const LEVEL_POINTS = { easy: 1, medium: 2, hard: 3 };
  const WYR_ROUNDS = 10;
  const LIKELY_ROUNDS = 10;
  const BOMB_ROUNDS = 5;
  const pts = n => `${n} ${n === 1 ? 'point' : 'points'}`;
  const roleFor = game => roles[game.id] || { ask: 'Who’s up?', verb: 'plays', note: name => `${name} is up. Everyone else, cheer them on!` };
  // One word or phrase per line; blanks and case-insensitive repeats are dropped.
  function parseHouseWords(source) {
    const lines = Array.isArray(source) ? source : String(source || '').split(/\r?\n/);
    const seen = new Set();
    return lines.filter(line => typeof line === 'string').map(line => line.replace(/\s+/g, ' ').trim().slice(0, 40)).filter(line => {
      const key = line.toLocaleLowerCase();
      if (!line || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 100);
  }
  const knownCategory = (gameId, category, words) => category === 'all' || (category === 'house' && houseGames.includes(gameId) && words.length > 0) || getCategories(gameId).some(c => c.id === category);
  const defaults = () => ({ players: Array.from({ length: 6 }, (_, i) => ({ id: `player-${i + 1}`, name: '' })), teamCount: 2, teams: [], history: [], nextTeam: 0, gameOptions: {}, customWords: [], soundEnabled: true, volume: 0.45 });
  const avatarFor = player => AVATARS.includes(player?.emoji) ? player.emoji : AVATARS[(Number(String(player?.id || '').split('-')[1]) - 1) % AVATARS.length] || AVATARS[0];
  let storageAvailable = true;
  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return defaults();
      const value = JSON.parse(stored);
      if (!value || !Array.isArray(value.players) || value.players.length < 2 || value.players.length > 40) return defaults();
      if (!value.players.every((p, i) => p && p.id === `player-${i + 1}` && typeof p.name === 'string' && p.name.length <= 24)) return defaults();
      const players = value.players.map(p => ({ id: p.id, name: p.name, ...(AVATARS.includes(p.emoji) ? { emoji: p.emoji } : {}) }));
      if (!Number.isInteger(value.teamCount) || value.teamCount < 2 || value.teamCount > Math.min(8, value.players.length)) return defaults();
      let teams = [];
      if (Array.isArray(value.teams) && value.teams.length === value.teamCount) {
        const ids = value.teams.flatMap(t => Array.isArray(t?.players) ? t.players.map(p => p?.id) : []);
        if (ids.length === value.players.length && new Set(ids).size === ids.length && ids.every(id => value.players.some(p => p.id === id)) && value.teams.every(t => Number.isInteger(t.score) && t.score >= 0 && t.score <= 9999)) {
          teams = value.teams.map((team, i) => ({ id: `team-${i + 1}`, ...TEAM_PALETTE[i], players: team.players.map(p => ({ ...players.find(player => player.id === p.id) })), score: team.score }));
        }
      }
      const history = Array.isArray(value.history) && teams.length ? value.history.filter(h => h && getGame(h.gameId) && teams.some(t => t.id === h.teamId) && Number.isInteger(h.points) && h.points >= 0 && h.points <= 9999 && Number.isFinite(h.time)).slice(0, 30) : [];
      const customWords = Array.isArray(value.customWords) ? parseHouseWords(value.customWords) : [];
      const gameOptions = {};
      GAMES.forEach(game => {
        const option = value.gameOptions?.[game.id];
        if (option && modes.includes(option.mode) && knownCategory(game.id, option.category, customWords)) gameOptions[game.id] = { category: option.category, mode: option.mode };
      });
      return { players, teamCount: value.teamCount, teams, history, nextTeam: Number.isInteger(value.nextTeam) && value.nextTeam >= 0 ? value.nextTeam % value.teamCount : 0, gameOptions, customWords, soundEnabled: value.soundEnabled !== false, volume: Number.isFinite(value.volume) ? Math.max(0, Math.min(1, value.volume)) : 0.45 };
    } catch { storageAvailable = false; return defaults(); }
  }
  let state = loadState();
  let filter = 'all';
  let toastTimer;
  let confirmResolve = null;
  let gameSession = null;
  let ticker = null;
  let imposterController = null;
  let triviaController = null;
  let phoneController = null;
  const decks = new Map();
  const displayName = player => player.name.trim() || `Player ${player.id.split('-')[1]}`;
  const teamPlayers = team => team.players.map(p => state.players.find(player => player.id === p.id) || p);
  const sound = window.GameNightSounds?.create({ enabled: state.soundEnabled, volume: state.volume, onUnavailable: () => toast('Sounds aren’t available in this browser. Every game still works.') }) || { unlock: () => Promise.resolve(false), play() { return false; }, stop() {}, setEnabled() {}, setVolume() {} };
  function unlockSound() { if (state.soundEnabled) Promise.resolve(sound.unlock()).catch(() => {}); }
  function cue(name) { if (state.soundEnabled) sound.play(name); }
  function celebrate(count = 90) {
    const dialog = $('#game-dialog');
    window.GameNightEffects?.confetti(dialog.open ? dialog : document.body, { count });
  }
  function renderSoundControls() {
    $$('[data-sound-toggle]').forEach(button => {
      button.textContent = state.soundEnabled ? '♫ Sound on' : '♪ Sound off';
      button.setAttribute('aria-pressed', String(state.soundEnabled));
      button.setAttribute('aria-label', state.soundEnabled ? 'Mute game sounds' : 'Enable game sounds');
    });
    $$('[data-sound-volume]').forEach(input => { input.value = state.volume; });
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageAvailable = true; }
    catch { storageAvailable = false; }
    $('#save-status').textContent = storageAvailable ? 'Your night is saved on this device' : 'Playing in memory · browser saving unavailable';
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').classList.add('show');
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500);
  }
  function confirmAction(message, title = 'Start fresh?', label = 'Yes, start fresh') {
    if (confirmResolve) return Promise.resolve(false);
    $('#confirm-title').textContent = title;
    $('#confirm-message').textContent = message;
    $('#confirm-accept').textContent = label;
    $('#confirm-dialog').showModal();
    $('#confirm-cancel').focus();
    return new Promise(resolve => { confirmResolve = resolve; });
  }
  function resolveConfirm(answer) {
    $('#confirm-dialog').close();
    if (confirmResolve) { confirmResolve(answer); confirmResolve = null; }
  }
  $('#confirm-accept').addEventListener('click', () => resolveConfirm(true));
  $('#confirm-cancel').addEventListener('click', () => resolveConfirm(false));
  $('#confirm-dialog').addEventListener('cancel', event => { event.preventDefault(); resolveConfirm(false); });
  const hasScores = () => state.history.length > 0 || state.teams.some(t => t.score > 0);

  function renderGames() {
    $$('[data-game-count]').forEach(element => { element.textContent = GAMES.length; });
    const note = game => game.phone ? 'SCAN THE CODE · PLAY ON PHONES' : game.phoneMode ? '📱 ON PHONES OR ONE SCREEN' : game.supportsDifficulty ? 'EASY → HARD · CROWN A CHAMPION' : game.id === 'imposter' ? 'ONE SECRET WORD · ONE IMPOSTER' : 'EVERYONE IN · NO POINTS NEEDED';
    $('#game-grid').innerHTML = GAMES.filter(game => filter === 'all' || game.category === filter).map(game => `
      <button class="game-card" data-game="${game.id}" aria-label="Play ${escape(game.title)}">
        <span class="card-art ${game.color}"><span class="game-badge">${escape(game.badge)}</span><img src="assets/${game.id}.svg" alt="" width="300" height="160"></span>
        <span class="card-body"><h3>${escape(game.title)}</h3><p>${escape(game.tagline)}</p><span class="card-level-note">${note(game)}</span><span class="card-meta"><span class="card-meta-details"><span>♧ ${game.maxPlayers ? `${game.minPlayers}–${game.maxPlayers}` : game.minPlayers + '+'} players</span><span>◷ ${escape(game.duration)}</span></span><span class="play-arrow" aria-hidden="true">↗</span></span></span>
      </button>`).join('');
  }
  function renderRoster() {
    $('#player-count').value = state.players.length;
    $('#count-minus').disabled = state.players.length <= 2;
    $('#count-plus').disabled = state.players.length >= 40;
    $('#player-inputs').innerHTML = state.players.map((player, i) => `<div class="player-field"><button type="button" class="player-avatar avatar-button" style="background:${avatarColors[i % avatarColors.length]}" data-avatar="${player.id}" aria-label="Change the face for Player ${i + 1}" title="Tap for a new face">${avatarFor(player)}</button><input type="text" data-player="${player.id}" value="${escape(player.name)}" placeholder="Player ${i + 1}" maxlength="24" aria-label="Player ${i + 1} name" autocomplete="off" spellcheck="false"></div>`).join('');
    $('#team-count').innerHTML = Array.from({ length: Math.min(8, state.players.length) - 1 }, (_, i) => `<option value="${i + 2}">${i + 2} teams</option>`).join('');
    $('#team-count').value = state.teamCount;
    updateNameCount();
    renderCrewResult();
  }
  function updateNameCount() {
    $('#name-count').textContent = `${state.players.filter(p => p.name.trim()).length} / ${state.players.length} named`;
  }
  function renderCrewResult() {
    $('#crew-result').hidden = !state.teams.length;
    $('#shuffle-teams').innerHTML = `<span aria-hidden="true">⤨</span> ${state.teams.length ? 'Shuffle the teams again' : 'Make random teams'} <span aria-hidden="true">↗</span>`;
    $('#crew-result').innerHTML = state.teams.map(team => `<div class="mini-team"><i class="team-dot" style="background:${team.color}"></i><strong>${escape(team.name)}</strong><span>${team.players.length} players</span></div>`).join('') + '<a href="#teams">Meet your teams <span aria-hidden="true">↗</span></a>';
  }
  async function changeCount(value) {
    const next = Number(value);
    if (!Number.isInteger(next) || next < 2 || next > 40) { $('#player-count').value = state.players.length; toast('Choose a whole number from 2 to 40.'); return; }
    if (next === state.players.length) return;
    if (hasScores() && !await confirmAction('Changing the guest list creates a fresh set of teams and clears the current scores. Your existing player names stay.')) { $('#player-count').value = state.players.length; return; }
    state.players = Array.from({ length: next }, (_, i) => state.players[i] || { id: `player-${i + 1}`, name: '' });
    state.teamCount = Math.min(state.teamCount, next);
    clearTeams();
    renderRoster();
    save();
  }
  function clearTeams() { state.teams = []; state.history = []; state.nextTeam = 0; decks.clear(); }
  async function shuffleTeams(navigate = true) {
    if (hasScores() && !await confirmAction('Shuffling creates new teams and resets the scoreboard. Everyone’s names will stay.', 'New teams, fresh scores?', 'Shuffle & reset')) return;
    state.teams = createTeams(state.players.map(p => ({ ...p, name: displayName(p) })), state.teamCount);
    state.history = [];
    state.nextTeam = 0;
    decks.clear();
    save();
    renderCrewResult();
    renderTeams();
    renderScoreboard();
    if (navigate) location.hash = 'teams';
    unlockSound();
    sound.play('shuffle');
    toast(`${state.players.length} people. ${state.teamCount} teams. Let the games begin!`);
  }
  function emptyState(title, description) {
    return `<div class="empty-state"><span class="empty-symbol" aria-hidden="true">⤨</span><h2>${escape(title)}</h2><p>${escape(description)}</p><button class="button button-orange" data-action="setup">Get the gang together ↗</button></div>`;
  }
  function renderTeams() {
    $('#reshuffle-teams').hidden = !state.teams.length;
    $('#team-cards').innerHTML = state.teams.length ? state.teams.map((team, i) => `<article class="team-card"><div class="team-card-heading" style="background:${team.color}40"><span class="team-emblem" aria-hidden="true">${symbols[i]}</span><div><h2>${escape(team.name)}</h2><p>${team.players.length} players · ${team.score} points</p></div></div><ul class="team-member-list">${teamPlayers(team).map(player => `<li><span class="player-avatar" aria-hidden="true">${avatarFor(player)}</span><span>${escape(displayName(player))}</span></li>`).join('')}</ul></article>`).join('') : emptyState('Every great night needs a crew.', 'Add your people and let chance choose the teams.');
  }
  function renderScoreboard() {
    $('#reset-scores').hidden = !state.teams.length;
    $('#crown-champions').hidden = !state.teams.length;
    if (!state.teams.length) { $('#scoreboard-list').innerHTML = emptyState('The competition starts with you.', 'Make your teams, pick a game, and earn those bragging rights.'); $('#recent-rounds').innerHTML = ''; return; }
    const sorted = [...state.teams].sort((a, b) => b.score - a.score);
    $('#scoreboard-list').innerHTML = sorted.map((team, i) => `<article class="score-row"><span class="score-rank">${sorted.findIndex(t => t.score === team.score) + 1}</span><div class="score-team"><h2><i class="team-dot" style="background:${team.color}"></i>${escape(team.name)}${team.score > 0 && team.score === sorted[0].score ? '<span class="leader-tag">IN THE LEAD</span>' : ''}</h2><p>${escape(teamPlayers(team).map(displayName).join(' · '))}</p></div><div class="score-controls"><button data-score="-1" data-team="${team.id}" aria-label="Subtract a point from ${escape(team.name)}" ${team.score === 0 ? 'disabled' : ''}>−</button><div class="score-value">${team.score}<small>points</small></div><button data-score="1" data-team="${team.id}" aria-label="Add a point to ${escape(team.name)}" ${team.score >= 9999 ? 'disabled' : ''}>+</button></div></article>`).join('');
    $('#recent-rounds').innerHTML = state.history.length ? `<h3>The night so far</h3>${state.history.slice(0, 8).map(entry => `<div class="history-row"><strong>${escape(state.teams.find(t => t.id === entry.teamId)?.name || '')} <span>· ${escape(getGame(entry.gameId).title)}</span></strong><span>+${entry.points} ${entry.points === 1 ? 'point' : 'points'} · ${escape(new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</span></div>`).join('')}` : '<div class="host-note"><span class="note-star" aria-hidden="true">✳</span><p>Good times are on the board. Points are up next.<br><strong>Finish a team game to record your first round.</strong></p></div>';
  }
  function route() {
    const page = ['lobby', 'games', 'teams', 'scoreboard'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'lobby';
    document.body.className = `view-${page}`;
    $('#hero').hidden = page !== 'lobby';
    $('#lobby-view').hidden = !['lobby', 'games'].includes(page);
    $('#teams-view').hidden = page !== 'teams';
    $('#scoreboard-view').hidden = page !== 'scoreboard';
    $$('.main-nav a').forEach(link => { link.classList.toggle('active', link.dataset.route === page); if (link.dataset.route === page) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
    renderTeams();
    renderScoreboard();
  }
  function focusSetup() {
    if (location.hash !== '#lobby') { location.hash = 'lobby'; route(); }
    const panel = $('#crew-panel');
    panel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    panel.classList.remove('setup-highlight');
    void panel.offsetWidth;
    panel.classList.add('setup-highlight');
    $('#player-count').focus({ preventScroll: true });
    $('#player-count').select();
  }

  const levelName = level => level.charAt(0).toUpperCase() + level.slice(1);
  function optionsFor(game) {
    return state.gameOptions[game.id] || { category: 'all', mode: 'auto' };
  }
  function categoriesFor(game) {
    const list = getCategories(game.id);
    return houseGames.includes(game.id) && state.customWords.length ? [...list, { id: 'house', label: `House words (${state.customWords.length})` }] : list;
  }
  // House words are the group's own, so they have no levels to climb.
  const matchLevels = (game, category, mode) => (category === 'house' || !game.supportsDifficulty ? [null] : mode === 'auto' ? LEVELS.slice() : [mode]);
  const worthOf = s => LEVEL_POINTS[s.level] || 1;
  // A match: every team gets one turn per level, Easy → Medium → Hard, then a champion is crowned.
  function createMatch(game, category, mode, firstTeam) {
    const start = Number.isInteger(firstTeam) && firstTeam >= 0 ? firstTeam % state.teams.length : 0;
    return { levels: matchLevels(game, category, mode), levelIndex: 0, order: state.teams.map((_, i) => (start + i) % state.teams.length), turn: 0, totals: Object.fromEntries(state.teams.map(t => [t.id, 0])) };
  }
  // Returns true when a correct answer lands on a streak milestone (3, 5, 10…).
  function updateStreak(s, correct) {
    if (!s.team) return false;
    if (!correct) { s.streak = 0; return false; }
    s.streak += 1;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    if (!STREAK_MILESTONES.includes(s.streak)) return false;
    if (s.streak >= 5) celebrate(60);
    return true;
  }
  function nextPrompt(s) {
    if (s.category === 'house' && state.customWords.length) {
      const key = `${s.game.id}|house`;
      if (!decks.get(key)?.length) decks.set(key, shuffle(state.customWords.map(text => ({ text, category: 'house' }))));
      return decks.get(key).pop();
    }
    const filters = {};
    if (getCategories(s.game.id).length > 1) filters.category = s.category || 'all';
    if (s.game.supportsDifficulty && s.level) filters.difficulty = s.level;
    const key = [s.game.id, filters.category || 'all', filters.difficulty || 'any'].join('|');
    if (!decks.get(key)?.length) decks.set(key, createDeck(s.game.id, Math.random, filters));
    return decks.get(key).pop();
  }
  function floatAll(list) {
    list.slice(0, 3).forEach(emoji => window.GameNightEffects?.floatEmoji($('#game-dialog'), emoji));
  }
  // The host reacts on their own: a one-liner and emojis that match what just happened.
  function hostSays(s, kind, name) {
    const banter = window.GameNightBanter;
    if (!banter) return;
    s.quip = banter.line(kind, { name: name || (s.actor ? displayName(s.actor) : 'Everyone') });
    floatAll(banter.emojis(kind));
  }
  function stopControllers() {
    clearInterval(ticker);
    imposterController?.destroy();
    imposterController = null;
    triviaController?.destroy();
    triviaController = null;
    phoneController?.destroy();
    phoneController = null;
    $('#game-dialog').classList.remove('stage-mode');
  }
  const enterStage = () => $('#game-dialog').classList.add('stage-mode');
  function openGame(id) {
    const game = getGame(id);
    if (!game) return;
    stopControllers();
    gameSession = { game, phase: 'rules' };
    renderRules();
    if (!$('#game-dialog').open) $('#game-dialog').showModal();
  }
  function renderRules() {
    const { game } = gameSession;
    const count = state.players.length;
    const isImposter = game.id === 'imposter';
    const isTrivia = game.id === 'trivia';
    const isPhone = Boolean(game.phone);
    const needsPlayers = !isPhone && count < game.minPlayers;
    const tooMany = !isPhone && Boolean(game.maxPlayers) && count > game.maxPlayers;
    const needsTeammates = performerGames.includes(game.id) && Math.floor(count / state.teamCount) < 2;
    const needsSetup = needsPlayers || tooMany || needsTeammates;
    const timed = !isPhone && !['would-you-rather', 'five-second', 'imposter', 'most-likely', 'pass-bomb'].includes(game.id);
    const teamGame = game.category === 'team';
    const duration = game.id === 'trivia' ? 30 : 60;
    const categories = categoriesFor(game);
    const option = optionsFor(game);
    const kicker = isPhone ? 'GRAB YOUR PHONES' : teamGame ? 'A LITTLE FRIENDLY COMPETITION' : isImposter ? 'TRUST NO ONE (NICELY)' : 'GET EVERYONE TALKING';
    const note = needsPlayers ? `This game needs at least ${game.minPlayers} players. Add a few more friends to your guest list.`
      : tooMany ? `${game.title} works with up to ${game.maxPlayers} players. You have ${count}, so trim the guest list for this one.`
      : needsTeammates ? 'Every performer needs a teammate to guess! Choose fewer teams or add players so each team has at least two people.'
      : isPhone ? `Everyone plays on their own phone: ${game.minPlayers === game.maxPlayers ? `${game.minPlayers} players` : `${game.minPlayers}–${game.maxPlayers} players`}. Phones must be on the same Wi-Fi as this laptop.`
      : isImposter ? `All ${count} players get a secret role. Pass the screen around and keep it private.`
      : isTrivia ? (state.teams.length ? `All ${state.teams.length} teams take a turn in the hot seat, starting with ${state.teams[state.nextTeam].name}.` : `Starting will split your ${count} players into ${state.teamCount} random teams. Every team takes a turn.`)
      : teamGame && !state.teams.length ? `Ready when you are. Starting will split your ${count} players into ${state.teamCount} random teams.`
      : teamGame ? `Every team takes a turn at each level, starting with ${state.teams[state.nextTeam].name}. The best total wins.`
      : 'Everyone plays together. No teams or points needed.';
    const nameless = state.players.filter(p => !p.name.trim()).length;
    const namePanel = nameless && !isPhone ? `<details class="name-crew"${nameless === count ? ' open' : ''}><summary><span><b>✎ Name your players</b><small>${nameless} of ${count} still go by “Player”. Names show up in the spotlight.</small></span><span class="house-toggle" aria-hidden="true">+</span></summary><div class="name-crew-grid">${state.players.map((p, i) => `<label class="name-crew-field"><span aria-hidden="true">${avatarFor(p)}</span><input type="text" data-name-player="${p.id}" value="${escape(p.name)}" placeholder="Player ${i + 1}" maxlength="24" aria-label="Player ${i + 1} name" autocomplete="off" spellcheck="false"></label>`).join('')}</div></details>` : '';
    const settings = [
      teamGame && !isTrivia ? `<label>Who goes first?<select id="playing-team">${state.teams.length ? state.teams.map((t, i) => `<option value="${i}" ${i === state.nextTeam ? 'selected' : ''}>${escape(t.name)}</option>`).join('') : '<option value="0">First team · randomly picked</option>'}</select></label>` : '',
      categories.length > 1 ? `<label>Category<select id="game-category"><option value="all">${isImposter ? 'Surprise me · any category' : 'Mixed · all categories'}</option>${categories.map(c => `<option value="${escape(c.id)}" ${c.id === option.category ? 'selected' : ''}>${escape(c.label)}</option>`).join('')}</select></label>` : '',
      game.supportsDifficulty ? `<label>Levels<select id="game-level">${modes.map(mode => `<option value="${mode}" ${mode === option.mode ? 'selected' : ''}>${mode === 'auto' ? 'All three · Easy → Medium → Hard' : `${levelName(mode)} only`}</option>`).join('')}</select></label>` : '',
      timed ? `<label>${isTrivia ? 'Time per question' : 'Round length'}<select id="round-duration">${[15, 30, 60, 90, 120].map(seconds => `<option value="${seconds}" ${seconds === duration ? 'selected' : ''}>${seconds} seconds</option>`).join('')}</select></label>` : '',
      isImposter ? `<label>Discussion time<select id="round-duration">${[60, 120, 180, 300].map(seconds => `<option value="${seconds}" ${seconds === 180 ? 'selected' : ''}>${seconds / 60} ${seconds === 60 ? 'minute' : 'minutes'}</option>`).join('')}</select></label>` : ''
    ].join('');
    $('#game-content').innerHTML = `<div class="rules-header"><img class="${game.color}" src="assets/${game.id}.svg" alt="" width="300" height="160"><span class="section-kicker">${kicker}</span><h2 id="dialog-title">${escape(game.title)}</h2><p>${escape(game.description)}</p></div><ol class="rules-list">${game.rules.map(rule => `<li>${escape(rule.replace(/60 seconds|30 seconds/g, 'the chosen time'))}</li>`).join('')}</ol>
      <p class="auto-team-note">${escape(note)}</p>${game.phoneMode ? '<p class="phone-mode-note"><b>📱 Best on phones:</b> everyone scans a code, types their name, and plays privately on their own phone. No Wi-Fi? Pass one screen around instead.</p>' : ''}${namePanel}
      <div class="game-settings">${settings}</div>${game.supportsDifficulty && !needsSetup ? '<p class="level-preview" id="level-preview"></p>' : ''}<div class="dialog-actions">${game.phoneMode ? '<button class="button button-orange" data-action="start-phones">📱 Play on phones ↗</button>' : ''}${needsSetup ? `<button class="button ${game.phoneMode ? 'button-outline' : 'button-orange'}" data-action="add-players">${needsTeammates && !needsPlayers ? 'Adjust your teams' : 'Edit the guest list'} ↗</button>` : `<button class="button ${game.phoneMode ? 'button-outline' : 'button-dark'}" data-action="start-round">${game.phoneMode ? 'Pass one screen' : game.id === 'would-you-rather' ? 'Let’s talk' : isImposter ? 'Hand out secret roles' : isPhone ? 'Open the table' : teamGame ? 'Start the show' : 'Start playing'} <span aria-hidden="true">↗</span></button>`}</div>`;
    updateLevelPreview();
  }
  function updateLevelPreview() {
    const preview = $('#level-preview');
    if (!preview || gameSession?.phase !== 'rules') return;
    const { game } = gameSession;
    const category = $('#game-category')?.value || 'all';
    const mode = $('#game-level')?.value || 'auto';
    const team = state.teams[Number($('#playing-team')?.value || 0)];
    if (game.id === 'trivia') {
      const { QUESTIONS_PER_LEVEL, LEVEL_POINTS } = window.GameNightTrivia;
      const levels = mode === 'auto' ? LEVELS : [mode];
      const teams = state.teams.length || state.teamCount;
      preview.innerHTML = `${levels.map(level => `<span class="level-chip level-${level}">${levelName(level)} · ${LEVEL_POINTS[level]} ${LEVEL_POINTS[level] === 1 ? 'pt' : 'pts'}</span>`).join('')}<span>Each team plays ${QUESTIONS_PER_LEVEL} questions per level, with a halftime huddle after 5. That’s ${teams * levels.length * QUESTIONS_PER_LEVEL} questions across ${teams} teams.</span>`;
      return;
    }
    const levels = matchLevels(game, category, mode);
    const teams = state.teams.length || state.teamCount;
    const chips = levels.map(level => (level ? `<span class="level-chip level-${level}">${levelName(level)} · ${LEVEL_POINTS[level]} ${LEVEL_POINTS[level] === 1 ? 'pt' : 'pts'}</span>` : '<span class="level-chip level-house">House · 1 pt</span>')).join('');
    const turns = teams * levels.length;
    const what = category === 'house' ? `${state.customWords.length} of your own words, in a random order. ` : '';
    preview.innerHTML = `${chips}<span>${escape(what)}Every team gets one turn${levels.length > 1 ? ' per level, from Easy to Hard' : ''}. That’s ${turns} turns, then we crown a champion.</span>`;
  }
  function startRound(settings) {
    const game = gameSession.game;
    const saved = optionsFor(game);
    const category = settings?.category ?? ($('#game-category')?.value || saved.category);
    const mode = settings?.mode ?? ($('#game-level')?.value || saved.mode);
    if (categoriesFor(game).length > 1 || game.supportsDifficulty) { state.gameOptions[game.id] = { category, mode }; save(); }
    if (game.phone) { startPhones(game); return; }
    if (game.id === 'imposter') { startImposter(Number(settings?.duration || $('#round-duration')?.value || 180), category); return; }
    if (game.category === 'team' && !state.teams.length) {
      state.teams = createTeams(state.players.map(p => ({ ...p, name: displayName(p) })), state.teamCount);
      state.history = [];
      state.nextTeam = 0;
      renderCrewResult();
      save();
    }
    if (game.id === 'trivia') { startTrivia(Number(settings?.duration || $('#round-duration')?.value || 30), category, mode); return; }
    const isFive = game.id === 'five-second';
    const untimed = ['would-you-rather', 'most-likely', 'pass-bomb'].includes(game.id);
    const duration = untimed ? 0 : isFive ? 5 : Number(settings?.duration || $('#round-duration')?.value || 60);
    const picked = $('#playing-team') ? Number($('#playing-team').value) : state.nextTeam;
    const match = game.category === 'team' ? settings?.match || createMatch(game, category, mode, picked) : null;
    const teamIndex = match ? match.order[match.turn] : null;
    const team = match ? state.teams[teamIndex] : null;
    const priorTurns = team ? state.history.filter(h => h.teamId === team.id && h.gameId === game.id).length : 0;
    const actor = team ? teamPlayers(team)[priorTurns % team.players.length] : null;
    gameSession = { game, phase: team ? 'spotlight' : 'playing', duration, remaining: duration * 1000, deadline: performance.now() + duration * 1000, teamIndex, team, actor, category, mode, match, level: match ? match.levels[match.levelIndex] : null, points: 0, skipped: 0, seen: 1, streak: 0, bestStreak: 0, prompt: null, paused: false, lastTick: null, lastResult: null, quip: '', peek: false, fiveState: isFive ? 'ready' : null, titles: {}, blasts: {}, bombState: game.id === 'pass-bomb' ? 'ready' : null, passes: 0 };
    enterStage();
    if (team) { renderSpotlight(); cue('spotlight'); return; }
    lightsUp();
  }
  function renderSpotlight() {
    const s = gameSession;
    const role = roleFor(s.game);
    const players = teamPlayers(s.team);
    const name = displayName(s.actor);
    const m = s.match;
    const level = s.level ? `LEVEL ${m.levelIndex + 1} OF ${m.levels.length} · ${s.level.toUpperCase()}` : s.category === 'house' ? 'HOUSE WORDS' : 'ANYTHING GOES';
    const picker = players.length < 2 ? `<p class="tv-note">${escape(name)} is flying solo for ${escape(s.team.name)}.</p>`
      : `<h3 class="tv-seat-heading">${escape(role.ask)}</h3><div class="tv-seats" role="group" aria-label="${escape(role.ask)}">${players.map((p, i) => `<button type="button" class="tv-seat${p.id === s.actor.id ? ' is-up' : ''}" data-actor="${p.id}" aria-pressed="${p.id === s.actor.id}" style="--i:${i}"><span class="tv-avatar" aria-hidden="true">${avatarFor(p)}</span>${escape(displayName(p))}</button>`).join('')}</div>`;
    $('#game-content').innerHTML = `<section class="tv-show" data-stage="spotlight">${marquee}<div class="tv-card tv-team-intro" style="--team:${s.team.color}"><div class="tv-spotlight" aria-hidden="true"></div><span class="tv-kicker">${escape(s.game.title.toUpperCase())} · ${escape(level)}</span><h2 id="dialog-title" class="tv-team-name">${escape(s.team.name)}</h2><p class="tv-lede">step into the spotlight! Team ${m.turn + 1} of ${m.order.length}${s.duration && !s.fiveState ? ` · ${s.duration} seconds` : ''} · ${pts(worthOf(s))} a pop</p>${picker}<p class="tv-note">${escape(role.note(name))}</p><div class="dialog-actions"><button type="button" class="button tv-button" data-action="lights-up">Lights up · ${escape(name)} ${escape(role.verb)} <span aria-hidden="true">↗</span></button></div><p class="shortcut-hint tv-keys">Host keys <span><kbd>G</kbd> lights up</span></p></div>${reactionsMarkup}</section>`;
  }
  function pickActor(id) {
    const s = gameSession;
    const player = s?.phase === 'spotlight' ? teamPlayers(s.team).find(p => p.id === id) : null;
    if (!player || player.id === s.actor.id) return;
    s.actor = player;
    cue('pop');
    renderSpotlight();
  }
  // Starts the clock once the performer is ready. Group games skip the spotlight and come straight here.
  function lightsUp() {
    const s = gameSession;
    if (!s || !['spotlight', 'playing'].includes(s.phase) || s.prompt) return;
    s.phase = 'playing';
    s.prompt = nextPrompt(s);
    s.remaining = s.duration * 1000;
    s.deadline = performance.now() + s.remaining;
    renderRound();
    clearInterval(ticker);
    if (s.duration && !s.fiveState) ticker = setInterval(tick, 100);
    cue('start');
  }
  function startImposter(duration, category) {
    const game = getGame('imposter');
    stopControllers();
    const Imposter = window.GameNightImposter;
    if (!Imposter) { toast('Guess the Imposter couldn’t load. Refresh the page and try again.'); return; }
    gameSession = { game, phase: 'imposter', duration, category, mode: 'auto' };
    enterStage();
    const prompt = nextPrompt(gameSession);
    try {
      imposterController = Imposter.create({
        container: $('#game-content'),
        players: state.players.map(p => ({ id: p.id, name: displayName(p), avatar: avatarFor(p) })),
        reactions: reactionsMarkup,
        prompt: { text: prompt.text, label: categoryLabel(prompt.category) },
        duration,
        onSound: name => { cue(name); if (name === 'correct') celebrate(140); },
        onClose: closeGame,
        onReplay: () => startImposter(duration, category)
      });
    } catch (error) {
      toast(error.message);
      openGame('imposter');
    }
  }
  function startTrivia(duration, category, mode) {
    const game = getGame('trivia');
    stopControllers();
    const Trivia = window.GameNightTrivia;
    if (!Trivia) { toast('Trivia couldn’t load. Refresh the page and try again.'); return; }
    gameSession = { game, phase: 'trivia', duration, category, mode };
    enterStage();
    try {
      triviaController = Trivia.create({
        container: $('#game-content'),
        teams: state.teams.map(team => ({ id: team.id, name: team.name, color: team.color, players: teamPlayers(team).map(p => ({ id: p.id, name: displayName(p), avatar: avatarFor(p) })) })),
        reactions: reactionsMarkup,
        quip: (kind, name) => window.GameNightBanter?.line(kind, { name }) || '',
        onOutcome: kind => floatAll(window.GameNightBanter?.emojis(kind) || []),
        levels: mode === 'auto' ? LEVELS : [mode],
        duration,
        category,
        prompts: game.prompts,
        startTeam: state.nextTeam,
        categoryLabel,
        onSound: cue,
        onCelebrate: celebrate,
        onNotice: toast,
        onScore: (teamId, points) => {
          const team = state.teams.find(t => t.id === teamId);
          if (!team) return;
          team.score = Math.min(9999, team.score + points);
          save(); renderTeams(); renderScoreboard();
        },
        onTeamDone: recordTriviaRound,
        onClose: closeGame,
        onReplay: () => startTrivia(duration, category, mode)
      });
    } catch (error) {
      toast(error.message);
      openGame('trivia');
    }
  }
  function startPhones(game) {
    // Imposter tables take the chosen category, clue time and any house words along.
    const roomOptions = {};
    if (game.id === 'imposter') {
      const category = $('#game-category')?.value || optionsFor(game).category;
      Object.assign(roomOptions, { category, duration: Number($('#round-duration')?.value || 180), words: category === 'house' ? state.customWords : undefined });
      state.gameOptions[game.id] = { category, mode: 'auto' };
      save();
    }
    stopControllers();
    const Phones = window.GameNightPhones;
    if (!Phones) { toast('Phone games couldn’t load. Refresh the page and try again.'); return; }
    gameSession = { game, phase: 'phones' };
    enterStage();
    phoneController = Phones.create({
      container: $('#game-content'),
      gameId: game.id,
      roomOptions,
      banter: window.GameNightBanter,
      reactions: reactionsMarkup,
      onSound: cue,
      onCelebrate: celebrate,
      react: emoji => window.GameNightEffects?.floatEmoji($('#game-dialog'), emoji),
      toast,
      onClose: closeGame
    });
  }
  // Points reach the scoreboard as they're won; this logs the team's finished round.
  function recordTriviaRound(teamId, points) {
    const index = state.teams.findIndex(t => t.id === teamId);
    if (index < 0) return;
    state.history.unshift({ gameId: 'trivia', teamId, points, time: Date.now() });
    state.history = state.history.slice(0, 30);
    state.nextTeam = (index + 1) % state.teams.length;
    save(); renderScoreboard();
  }
  // Logs a team round cut short by closing the show. Returns true when one was in progress.
  function endTriviaEarly() {
    const current = triviaController?.current();
    if (!current?.inRound) return false;
    recordTriviaRound(current.teamId, current.points);
    return true;
  }
  function tick() {
    const s = gameSession;
    if (s?.bombState === 'ticking' && s.phase === 'playing') { bombTick(s); return; }
    if (!s || s.phase !== 'playing' || !s.duration || s.paused) return;
    if (s.fiveState && s.fiveState !== 'running') return;
    s.remaining = Math.max(0, s.deadline - performance.now());
    updateClock();
    const seconds = Math.ceil(s.remaining / 1000);
    if (seconds > 0 && seconds <= 5 && seconds !== s.lastTick) { s.lastTick = seconds; cue('tick'); }
    if (s.remaining === 0) {
      if (s.fiveState) stopFiveSecond();
      else finishRound('time');
    }
  }
  // The fuse is hidden. Ticks speed up as it burns, then BOOM.
  function bombTick(s) {
    const now = performance.now();
    const left = s.deadline - now;
    if (left <= 0) {
      clearInterval(ticker);
      s.bombState = 'boom';
      cue('buzzer');
      floatAll(['💥', '😵', '🔥']);
      renderRound();
      return;
    }
    if (now >= s.nextBeep) { cue('tick'); s.nextBeep = now + Math.max(160, 900 * (left / s.fuse)); }
    const bomb = $('#bomb');
    if (bomb) bomb.style.setProperty('--speed', `${Math.max(0.18, 0.9 * (left / s.fuse)).toFixed(2)}s`);
  }
  // The performer's face reacts to the clock and to how the round is going.
  function moodFor(s) {
    if (s.paused) return ['😴', 'taking a breather'];
    if (s.fiveState === 'running') return ['😵‍💫', 'racing the clock'];
    if (s.fiveState === 'judging') return ['🤞', 'hoping'];
    const seconds = Math.ceil(s.remaining / 1000);
    if (s.duration && !s.fiveState && seconds <= 5) return ['😱', 'nearly out of time'];
    if (s.duration && !s.fiveState && seconds <= 10) return ['😰', 'feeling the pressure'];
    if (s.streak >= 5) return ['🔥', 'on fire'];
    if (s.streak >= 3) return ['😎', 'on a roll'];
    if (s.lastResult === 'right') return ['🤩', 'thrilled'];
    if (s.lastResult === 'miss') return ['😅', 'shaking it off'];
    return ['😃', 'ready'];
  }
  function updateClock() {
    const s = gameSession;
    const clock = $('#round-clock');
    if (!s || !clock) return;
    const seconds = Math.ceil(s.remaining / 1000);
    const urgent = seconds <= (s.fiveState ? 2 : 10);
    clock.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    clock.classList.toggle('urgent', urgent);
    const ring = clock.closest('.tv-clock');
    ring?.style.setProperty('--p', Math.max(0, Math.min(1, s.remaining / (s.duration * 1000))).toFixed(3));
    ring?.classList.toggle('is-urgent', urgent && s.phase === 'playing' && !s.paused);
    const badge = $('#actor-mood');
    if (!badge || !s.actor) return;
    const [emoji, feeling] = moodFor(s);
    if (badge.textContent === emoji) return;
    badge.textContent = emoji;
    badge.setAttribute('aria-label', `${displayName(s.actor)} is ${feeling}`);
    badge.classList.remove('is-new');
    void badge.offsetWidth;
    badge.classList.add('is-new');
  }
  function fiveSecondMarkup(s) {
    if (s.fiveState === 'running') return { hint: 'Go, go, go! Count them out loud.', actions: '<button class="button tv-button" data-action="five-stop">They named three! Stop ↗</button>' };
    if (s.fiveState === 'judging') return { hint: 'Time! Did they name three fair answers?', actions: `<button class="button tv-button-ghost" data-action="five-miss">Not quite</button><button class="button tv-button tv-got" data-action="five-hit">Got all three! +${worthOf(s)}</button>` };
    return { hint: 'Read it aloud, then start the clock.', actions: '<button class="button tv-button-ghost" data-action="skip-prompt">Skip →</button><button class="button tv-button" data-action="five-go">Start 5 seconds ↗</button>' };
  }
  function renderRound() {
    const s = gameSession;
    const game = s.game;
    const isChoice = game.id === 'would-you-rather';
    const isCategory = game.id === 'categories';
    const isLikely = game.id === 'most-likely';
    const isBomb = game.id === 'pass-bomb';
    const five = s.fiveState ? fiveSecondMarkup(s) : null;
    const worth = worthOf(s);
    const hints = { categories: 'One answer each. No repeats. Five seconds to think!', quickdraw: 'Just the artist looks. Grab your paper and pen.', taboo: 'No gestures, spelling, or parts of the answer.', 'who-am-i': 'Guesser: hold the screen to your forehead. Team: describe it!' };
    const hintsMore = { 'emoji-decode': 'Team: shout your guesses!' };
    const label = isCategory ? 'GO AROUND THE CIRCLE' : game.id === 'taboo' ? 'GET YOUR TEAM TO SAY' : isLikely ? 'WHO’S MOST LIKELY TO…' : isBomb ? 'NAME SOMETHING THAT FITS' : s.prompt.category ? categoryLabel(s.prompt.category) : 'YOUR PROMPT';
    let promptMarkup = '';
    if (s.paused) {
      promptMarkup = '<div class="round-pause tv-pause"><span class="tv-emote" aria-hidden="true">😴</span><h3>Take a breather.</h3><p>The timer and prompt are on pause. No peeking!</p><button class="button tv-button" data-action="pause-round">Back to the fun ↗</button></div>';
    } else if (isChoice) {
      promptMarkup = `<div class="prompt-card tv-question tv-prompt" data-prompt="${s.seen}"><span class="tv-question-meta">EVERYONE HAS TO CHOOSE</span><h3 class="prompt-text tv-prompt-text">Would you rather…</h3></div><div class="choice-options tv-choices"><div class="choice-option tv-tile tile-a" style="--i:0"><span class="tv-tile-letter">A</span><span class="tv-tile-text">${escape(s.prompt.optionA)}</span></div><div class="choice-option tv-tile tile-c" style="--i:1"><span class="tv-tile-letter">B</span><span class="tv-tile-text">${escape(s.prompt.optionB)}</span></div></div><p class="tv-note">Pick a side. Tell the room why.</p>`;
    } else if (isLikely) {
      promptMarkup = `<div class="prompt-card tv-question tv-prompt" data-prompt="${s.seen}"><span class="tv-question-meta">${escape(label)}</span><h3 class="prompt-text tv-prompt-text">${escape(s.prompt.text)}?</h3><p class="tv-hint">On three, everyone points! 1… 2… 3… 👉</p></div><h3 class="tv-seat-heading">Who got the most fingers?</h3><div class="tv-seats tv-votes">${state.players.map((p, i) => `<button type="button" class="tv-seat" data-vote="${p.id}" style="--i:${i}"><span class="tv-avatar" aria-hidden="true">${avatarFor(p)}</span>${escape(displayName(p))}${s.titles[p.id] ? ` <b class="tv-title-count">${s.titles[p.id].length}</b>` : ''}</button>`).join('')}</div>`;
    } else if (isBomb) {
      const bombFace = s.bombState === 'boom' ? '💥' : '💣';
      promptMarkup = `<div class="prompt-card tv-question tv-prompt tv-bomb-card is-${s.bombState}" data-prompt="${s.seen}"><span class="tv-question-meta">${escape(label)}</span><h3 class="prompt-text tv-prompt-text">${escape(s.prompt.text)}</h3><div class="tv-bomb" id="bomb" aria-hidden="true">${bombFace}</div><p class="tv-hint">${s.bombState === 'ready' ? 'Light the fuse, give an answer, then pass the screen on.' : s.bombState === 'ticking' ? `Answer, then pass! ${s.passes} ${s.passes === 1 ? 'pass' : 'passes'} so far.` : 'BOOM! Who was holding it?'}</p></div>${s.bombState === 'boom' ? `<div class="tv-seats tv-votes">${state.players.map((p, i) => `<button type="button" class="tv-seat" data-blame="${p.id}" style="--i:${i}"><span class="tv-avatar" aria-hidden="true">${avatarFor(p)}</span>${escape(displayName(p))}${s.blasts[p.id] ? ` <b class="tv-title-count">💣${s.blasts[p.id]}</b>` : ''}</button>`).join('')}</div>` : ''}`;
    } else {
      const decode = game.id === 'emoji-decode';
      promptMarkup = `<div class="prompt-card tv-question tv-prompt${five ? ` five-${s.fiveState}` : ''}${decode ? ' tv-emoji-card' : ''}" data-prompt="${s.seen}"><span class="tv-question-meta">${escape(label)}</span><h3 class="prompt-text tv-prompt-text">${escape(s.prompt.text)}</h3>${decode ? `<button type="button" class="tv-peek" data-action="peek" aria-expanded="${s.peek}">${s.peek ? `<b class="tv-answer">${escape(s.prompt.answer)}</b>` : '👀 Holder only: peek at the answer'}</button>` : ''}${game.id === 'taboo' ? `<p class="tv-hint">You can’t say these words:</p><div class="forbidden-words">${s.prompt.forbidden.map((word, i) => `<span style="--i:${i}">${escape(word)}</span>`).join('')}</div>` : ''}<p class="tv-hint">${escape(five ? five.hint : hints[game.id] || hintsMore[game.id] || 'Only the actor looks. No talking, no sound effects.')}</p></div>`;
    }
    let levelRow = `<div class="tv-hud-level"><span class="tv-level tv-level-house">${isChoice ? 'Talk it out' : 'All together'}</span><small>NO POINTS NEEDED</small></div>`;
    if (s.category === 'house' && s.team) levelRow = `<div class="tv-hud-level level-row"><span class="tv-level tv-level-house">House words</span><small>Your own inside jokes · 1 pt each</small></div>`;
    else if (s.level) levelRow = `<div class="tv-hud-level level-row"><span class="tv-level tv-level-${s.level}">${levelName(s.level)}</span><small>${escape(s.category === 'all' ? 'Mixed categories' : categoryLabel(s.category))} · ${pts(worth)} each</small></div>`;
    else if (s.team) levelRow = '<div></div>';
    const [moodEmoji, feeling] = moodFor(s);
    const face = s.actor
      ? `<span class="tv-face"><span class="tv-face-emoji" aria-hidden="true">${avatarFor(s.actor)}</span><i class="tv-mood" id="actor-mood" role="img" aria-label="${escape(displayName(s.actor))} is ${feeling}">${moodEmoji}</i></span>`
      : `<span class="tv-face"><span class="tv-face-emoji" aria-hidden="true">${isChoice ? '🤔' : isLikely ? '👉' : isBomb ? '💣' : '🎉'}</span></span>`;
    const who = s.actor ? `${displayName(s.actor)} ${roleFor(game).verb}` : `${state.players.length} players`;
    const clock = s.duration ? '<div class="tv-clock" aria-label="Time remaining" role="timer"><span id="round-clock"></span></div>' : '<div></div>';
    const actions = five ? five.actions
      : isChoice ? `<button class="button tv-button" data-action="next-prompt">${s.seen >= WYR_ROUNDS ? 'That’s a wrap ↗' : 'Next dilemma ↗'}</button>`
      : isCategory ? '<button class="button tv-button" data-action="finish-round">We have a winner ↗</button>'
      : isLikely ? '<button class="button tv-button-ghost" data-action="next-prompt">Skip this one →</button>'
      : isBomb ? (s.bombState === 'ready' ? '<button class="button tv-button" data-action="bomb-start">Light the fuse 💣</button>' : s.bombState === 'ticking' ? '<button class="button tv-button tv-got tv-pass" data-action="bomb-pass">Answered! Pass it ➜</button>' : '')
      : `<button class="button tv-button-ghost" data-action="skip-prompt">Skip →</button><button class="button tv-button tv-got" data-action="correct-prompt">Got it! +${worth}</button>`;
    const stats = `<div class="round-stats tv-stats"><span>${isChoice ? `CONVERSATION ${s.seen} OF ${WYR_ROUNDS}` : isLikely ? `ROUND ${s.seen} OF ${LIKELY_ROUNDS}` : isBomb ? `ROUND ${s.seen} OF ${BOMB_ROUNDS}` : isCategory ? 'LAST ONE STANDING WINS' : `${s.points} ${s.points === 1 ? 'POINT' : 'POINTS'} THIS ROUND`}</span>${s.streak >= 3 ? `<span class="streak-chip" aria-label="${s.streak} in a row">🔥 ON FIRE ×${s.streak}</span>` : ''}<span>${game.category === 'team' ? `${s.skipped} ${five ? 'MISSED' : 'SKIPPED'}` : 'NO WRONG ANSWERS'}</span></div>${s.quip ? `<p class="tv-quip" role="status">💬 ${escape(s.quip)}</p>` : ''}`;
    $('#game-content').innerHTML = `<section class="tv-show" data-stage="round">${marquee}<h2 id="dialog-title" class="sr-only">${escape(game.title)}</h2><header class="tv-hud tv-hud-round" style="--team:${s.team ? s.team.color : '#e8b843'}"><div class="tv-hud-team">${face}<div class="round-team"><strong>${escape(s.team ? s.team.name : 'The whole gang')}</strong><small>${escape(who)}</small></div></div>${levelRow}${clock}</header>${stats}${promptMarkup}${s.paused ? '' : `<div class="dialog-actions tv-actions">${actions}</div>`}<div class="round-tools tv-tools">${s.duration && !five ? `<button data-action="pause-round">${s.paused ? 'Resume round' : 'Pause round'}</button>` : '<span></span>'}<button data-action="finish-round">${isChoice || isLikely || isBomb ? 'Finish playing' : five ? 'End turn' : 'End round'}</button></div>${shortcutHint(s)}${reactionsMarkup}</section>`;
    updateClock();
  }
  function shortcutHint(s) {
    const key = (k, label) => `<span><kbd>${k}</kbd> ${label}</span>`;
    let keys = [];
    if (s.paused) keys = [key('P', 'resume')];
    else if (s.fiveState === 'ready') keys = [key('G', 'start clock'), key('S', 'skip')];
    else if (s.fiveState === 'running') keys = [key('G', 'stop clock')];
    else if (s.fiveState === 'judging') keys = [key('Y', 'got three'), key('N', 'not quite')];
    else if (s.game.id === 'would-you-rather') keys = [key('N', 'next dilemma')];
    else if (s.game.category === 'team') keys = [key('G', 'got it'), key('S', 'skip'), key('P', 'pause')];
    return keys.length ? `<p class="shortcut-hint">Host keys ${keys.join('')}</p>` : '';
  }
  function activeBeforeDeadline() {
    if (!gameSession || gameSession.phase !== 'playing' || gameSession.paused) return false;
    tick();
    return gameSession.phase === 'playing';
  }
  function advancePrompt(correct) {
    if (!activeBeforeDeadline()) return;
    const s = gameSession;
    if (s.fiveState && s.fiveState !== 'ready') return;
    if (s.game.id === 'would-you-rather' && s.seen >= WYR_ROUNDS) { finishRound(); return; }
    if (s.game.id === 'most-likely' && s.seen >= LIKELY_ROUNDS) { finishRound(); return; }
    if (correct) s.points += worthOf(s);
    else if (s.game.category === 'team') s.skipped += 1;
    s.lastResult = correct ? 'right' : 'miss';
    const milestone = updateStreak(s, correct);
    cue(milestone ? 'streak' : correct ? 'correct' : s.game.category === 'team' ? 'skip' : 'reveal');
    if (s.team) hostSays(s, milestone ? 'streak' : correct ? 'right' : 'skip');
    s.prompt = nextPrompt(s);
    s.seen += 1;
    s.peek = false;
    renderRound();
  }
  function startFiveSecond() {
    const s = gameSession;
    if (!s || s.phase !== 'playing' || s.fiveState !== 'ready') return;
    s.fiveState = 'running';
    s.remaining = 5000;
    s.deadline = performance.now() + 5000;
    s.lastTick = null;
    clearInterval(ticker);
    ticker = setInterval(tick, 100);
    cue('start');
    renderRound();
  }
  function stopFiveSecond() {
    const s = gameSession;
    if (!s || s.phase !== 'playing' || s.fiveState !== 'running') return;
    clearInterval(ticker);
    s.fiveState = 'judging';
    cue('finish');
    renderRound();
  }
  function judgeFiveSecond(correct) {
    const s = gameSession;
    if (!s || s.phase !== 'playing' || s.fiveState !== 'judging') return;
    if (correct) s.points += worthOf(s); else s.skipped += 1;
    s.lastResult = correct ? 'right' : 'miss';
    const milestone = updateStreak(s, correct);
    cue(milestone ? 'streak' : correct ? 'correct' : 'wrong');
    hostSays(s, milestone ? 'streak' : correct ? 'right' : 'wrong');
    s.prompt = nextPrompt(s);
    s.seen += 1;
    s.fiveState = 'ready';
    s.remaining = 5000;
    renderRound();
  }
  function voteLikely(id) {
    const s = gameSession;
    const player = state.players.find(p => p.id === id);
    if (!s || s.phase !== 'playing' || s.game.id !== 'most-likely' || !player) return;
    (s.titles[id] = s.titles[id] || []).push(s.prompt.text);
    cue('correct');
    hostSays(s, 'vote', displayName(player));
    if (s.seen >= LIKELY_ROUNDS) { finishRound(); return; }
    s.prompt = nextPrompt(s);
    s.seen += 1;
    renderRound();
  }
  function lightFuse() {
    const s = gameSession;
    if (!s || s.phase !== 'playing' || s.bombState !== 'ready') return;
    s.bombState = 'ticking';
    s.passes = 0;
    s.quip = '';
    s.fuse = 20000 + Math.floor(Math.random() * 25000);
    s.deadline = performance.now() + s.fuse;
    s.nextBeep = 0;
    cue('start');
    renderRound();
    clearInterval(ticker);
    ticker = setInterval(tick, 100);
  }
  function passBomb() {
    const s = gameSession;
    if (!s || s.phase !== 'playing' || s.bombState !== 'ticking') return;
    tick();
    if (s.bombState !== 'ticking') return;
    s.passes += 1;
    cue('pop');
    renderRound();
  }
  function blame(id) {
    const s = gameSession;
    const player = state.players.find(p => p.id === id);
    if (!s || s.phase !== 'playing' || s.bombState !== 'boom' || !player) return;
    s.blasts[id] = (s.blasts[id] || 0) + 1;
    hostSays(s, 'boom', displayName(player));
    if (s.seen >= BOMB_ROUNDS) { finishRound(); return; }
    s.seen += 1;
    s.prompt = nextPrompt(s);
    s.bombState = 'ready';
    renderRound();
  }
  function pauseRound() {
    if (!gameSession || gameSession.phase !== 'playing' || gameSession.fiveState || !gameSession.duration) return;
    if (!gameSession.paused) { tick(); if (gameSession.phase !== 'playing') return; gameSession.paused = true; }
    else { gameSession.paused = false; gameSession.deadline = performance.now() + gameSession.remaining; }
    renderRound();
  }
  function finishRound(reason) {
    const s = gameSession;
    if (!s || s.phase !== 'playing') return;
    clearInterval(ticker);
    s.phase = 'summary';
    cue('finish');
    const m = s.match;
    if (s.team) {
      s.team.score = Math.min(9999, s.team.score + s.points);
      m.totals[s.team.id] += s.points;
      state.history.unshift({ gameId: s.game.id, teamId: s.team.id, points: s.points, time: Date.now() });
      state.history = state.history.slice(0, 30);
      state.nextTeam = (s.teamIndex + 1) % state.teams.length;
      save();
      renderTeams();
      renderScoreboard();
    }
    if (!s.team) { renderGroupSummary(s); return; }
    if (reason === 'time') hostSays(s, s.points >= 8 * worthOf(s) ? 'perfect' : 'timeout');
    if (s.points >= 3) celebrate(Math.min(180, 50 + s.points * 10));
    const lastTurn = m.turn === m.order.length - 1;
    const lastLevel = m.levelIndex === m.levels.length - 1;
    const next = lastTurn ? null : state.teams[m.order[m.turn + 1]];
    const nextAction = next ? ['next-turn', `Up next: ${next.name}`] : lastLevel ? ['final', 'Final results'] : ['standings', 'Level standings'];
    const emote = s.points >= 8 ? '🏆' : s.points >= 5 ? '😎' : s.points >= 3 ? '🙌' : s.points ? '🙂' : '😅';
    const face = s.actor ? `<span class="tv-face tv-face-big"><span class="tv-face-emoji" aria-hidden="true">${avatarFor(s.actor)}</span><i class="tv-mood is-new" aria-hidden="true">${emote}</i></span>` : `<div class="tv-emote" aria-hidden="true">${emote}</div>`;
    const where = s.level ? `Level ${m.levelIndex + 1} of ${m.levels.length} · ${levelName(s.level)}` : 'House words';
    const details = `<strong>${escape(s.team.name)} has ${pts(m.totals[s.team.id])} this game.</strong><br>${escape(where)} · team ${m.turn + 1} of ${m.order.length}${s.bestStreak >= 3 ? `<br>Best streak: <strong>🔥 ${s.bestStreak} in a row</strong>` : ''}`;
    $('#game-content').innerHTML = `<section class="tv-show" data-stage="summary">${marquee}<div class="summary tv-card tv-team-done" style="--team:${s.team.color}">${face}<span class="tv-kicker">THAT’S A ROUND</span><h2 id="dialog-title" class="tv-title tv-title-small">${s.points ? 'Nicely played.' : 'The next one’s yours.'}</h2><div class="round-score tv-big-score">+${s.points}</div><p class="tv-lede">${s.points === 1 ? 'point' : 'points'} for ${escape(s.team.name)}${s.actor ? `, led by ${escape(displayName(s.actor))}` : ''}</p>${s.quip ? `<p class="tv-quip" role="status">💬 ${escape(s.quip)}</p>` : ''}<div class="summary-details tv-note">${details}</div><div class="dialog-actions"><button class="button tv-button-ghost" data-action="back-games">Pick a game</button><button class="button tv-button" data-action="${nextAction[0]}">${escape(nextAction[1])} ↗</button></div><button class="text-link tv-link" data-action="view-scores">See the scoreboard →</button></div>${reactionsMarkup}</section>`;
  }
  function standingsMarkup(m) {
    const teams = m.order.map(i => state.teams[i]).sort((a, b) => m.totals[b.id] - m.totals[a.id]);
    const top = Math.max(1, ...teams.map(t => m.totals[t.id]));
    return `<ol class="tv-standings">${teams.map((t, i) => `<li style="--team:${t.color};--share:${(m.totals[t.id] / top).toFixed(3)};--i:${i}"><span class="tv-rank">${teams.filter(other => m.totals[other.id] > m.totals[t.id]).length + 1}</span><span class="tv-standing-name">${escape(t.name)}</span><span class="tv-bar"><i></i></span><b>${pts(m.totals[t.id])}</b></li>`).join('')}</ol>`;
  }
  function leadersOf(m) {
    const best = Math.max(...Object.values(m.totals));
    return state.teams.filter(t => m.totals[t.id] === best && m.order.includes(state.teams.indexOf(t)));
  }
  function renderStandings() {
    const s = gameSession;
    const m = s?.match;
    if (!m) return;
    s.phase = 'standings';
    const top = leadersOf(m);
    const best = m.totals[top[0].id];
    const nextLevel = m.levels[m.levelIndex + 1];
    cue('levelup');
    $('#game-content').innerHTML = `<section class="tv-show" data-stage="standings">${marquee}<div class="tv-card tv-level-done"><span class="tv-kicker">LEVEL ${m.levelIndex + 1} · ${escape(levelName(s.level).toUpperCase())} COMPLETE</span><h2 id="dialog-title" class="tv-title tv-title-small">${best === 0 ? 'Nobody’s on the board yet!' : top.length > 1 ? 'Neck and neck!' : `${escape(top[0].name)} leads the way!`}</h2>${standingsMarkup(m)}<p class="tv-note">Next up: ${escape(levelName(nextLevel))}, worth ${pts(LEVEL_POINTS[nextLevel])} for every right answer.</p><div class="dialog-actions"><button class="button tv-button" data-action="next-level">On to Level ${m.levelIndex + 2} · ${escape(levelName(nextLevel))} ↗</button></div></div>${reactionsMarkup}</section>`;
  }
  function renderFinal() {
    const s = gameSession;
    const m = s?.match;
    if (!m) return;
    s.phase = 'final';
    const top = leadersOf(m);
    const best = m.totals[top[0].id];
    const heading = best === 0 ? 'Nobody scored. Rematch?' : top.length > 1 ? `It’s a tie between ${top.map(t => t.name).join(' and ')}!` : `${top[0].name} wins ${s.game.title}!`;
    cue('champion');
    if (best > 0) { celebrate(200); floatAll(['🏆', '🎉', '👑']); }
    $('#game-content').innerHTML = `<section class="tv-show" data-stage="final">${marquee}<div class="tv-card tv-final"><span class="tv-kicker">AND THE ${escape(s.game.title.toUpperCase())} CHAMPION IS…</span><div class="tv-trophy" aria-hidden="true">🏆</div><h2 id="dialog-title" class="tv-title tv-title-small">${escape(heading)}</h2>${standingsMarkup(m)}<p class="tv-note">Every point is already on the scoreboard.</p><div class="dialog-actions"><button class="button tv-button-ghost" data-action="back-games">Pick another game</button><button class="button tv-button" data-action="replay-match">Play again ↗</button></div></div>${reactionsMarkup}</section>`;
  }
  // Group games end with awards instead of points.
  function renderGroupSummary(s) {
    let emote = '🎉';
    let heading = 'Keep the good times going.';
    let body = '<p class="summary-details tv-lede">Give the last player standing a little applause.<br>No points needed for a good time.</p>';
    if (s.game.id === 'would-you-rather') body = `<p class="summary-details tv-lede">${s.seen} ${s.seen === 1 ? 'dilemma' : 'dilemmas'}. A room full of opinions.<br>No points needed for a good time.</p>`;
    if (s.game.id === 'most-likely') {
      const ranked = state.players.filter(p => s.titles[p.id]).sort((a, b) => s.titles[b.id].length - s.titles[a.id].length);
      emote = '🏅';
      heading = ranked.length ? `${displayName(ranked[0])} collected the most titles!` : 'No titles handed out. Next time!';
      body = `<ul class="tv-awards">${ranked.map((p, i) => `<li style="--i:${i}"><span class="tv-avatar" aria-hidden="true">${avatarFor(p)}</span><b>${escape(displayName(p))}</b><span>Most likely to ${s.titles[p.id].map(t => escape(t.charAt(0).toLowerCase() + t.slice(1))).join(', ')}</span></li>`).join('')}</ul>`;
    }
    if (s.game.id === 'pass-bomb') {
      const ranked = state.players.map(p => ({ p, n: s.blasts[p.id] || 0 })).sort((a, b) => b.n - a.n);
      const fewest = Math.min(...ranked.map(r => r.n));
      const survivors = ranked.filter(r => r.n === fewest).map(r => displayName(r.p));
      emote = '💥';
      heading = ranked[0].n ? `${displayName(ranked[0].p)} is the bomb magnet!` : 'Nobody blew up. Impressive!';
      body = `<ul class="tv-awards">${ranked.filter(r => r.n).map((r, i) => `<li style="--i:${i}"><span class="tv-avatar" aria-hidden="true">${avatarFor(r.p)}</span><b>${escape(displayName(r.p))}</b><span>${'💣'.repeat(r.n)}</span></li>`).join('')}</ul><p class="tv-note">Coolest under pressure: ${escape(survivors.join(', '))} 😎</p>`;
    }
    if (['most-likely', 'pass-bomb'].includes(s.game.id)) celebrate(120);
    $('#game-content').innerHTML = `<section class="tv-show" data-stage="summary">${marquee}<div class="summary tv-card tv-team-done" style="--team:#e8b843"><div class="tv-emote" aria-hidden="true">${emote}</div><span class="tv-kicker">GOOD TIMES ALL AROUND</span><h2 id="dialog-title" class="tv-title tv-title-small">${escape(heading)}</h2>${body}<div class="dialog-actions"><button class="button tv-button-ghost" data-action="back-games">Pick a game</button><button class="button tv-button" data-action="next-round">Play again ↗</button></div></div>${reactionsMarkup}</section>`;
  }
  function closeGame() {
    if (gameSession?.phase === 'playing') {
      finishRound();
      toast(gameSession.team ? 'Round ended. Your points are on the board.' : 'Good round! Pick another game whenever you’re ready.');
    }
    if (gameSession?.phase === 'phones') toast('Table closed. Thanks for playing!');
    if (endTriviaEarly()) toast('Show’s over early. Every point won is on the board.');
    stopControllers();
    window.GameNightEffects?.clear();
    $('#game-dialog').close();
    gameSession = null;
  }
  function openPodium() {
    if (!state.teams.length) return;
    stopControllers();
    const ranked = [...state.teams].sort((a, b) => b.score - a.score);
    const rank = team => state.teams.filter(t => t.score > team.score).length + 1;
    const top = ranked[0].score;
    const tied = ranked.filter(t => t.score === top).length > 1;
    const heading = top === 0 ? 'Nobody’s on the board yet!' : tied ? 'It’s a tie at the top!' : `${ranked[0].name} takes the crown!`;
    const total = state.teams.reduce((sum, t) => sum + t.score, 0);
    const points = n => `${n} ${n === 1 ? 'point' : 'points'}`;
    // Classic podium order: second, first, third.
    const stage = [ranked[1], ranked[0], ranked[2]].filter(Boolean);
    gameSession = { phase: 'podium' };
    $('#game-content').innerHTML = `<div class="podium-view"><span class="section-kicker">AND THE CHAMPIONS ARE…</span><h2 id="dialog-title">${escape(heading)}</h2><p class="muted">${top === 0 ? 'Play a team game to earn some bragging rights.' : `${points(total)} scored across ${state.teams.length} teams. What a night.`}</p>
      <div class="podium">${stage.map(team => { const place = rank(team); return `<div class="podium-place place-${Math.min(place, 3)}" style="--team:${team.color}"><span class="podium-crown" aria-hidden="true">${place === 1 && top > 0 ? '♛' : ''}</span><strong>${escape(team.name)}</strong><span class="podium-names">${escape(teamPlayers(team).map(displayName).join(' · '))}</span><div class="podium-block"><span class="podium-rank">${place}</span><span class="podium-score">${points(team.score)}</span></div></div>`; }).join('')}</div>
      ${ranked.length > 3 ? `<ul class="podium-rest">${ranked.slice(3).map(team => `<li><span>${rank(team)}.</span><i class="team-dot" style="background:${team.color}"></i>${escape(team.name)}<b>${points(team.score)}</b></li>`).join('')}</ul>` : ''}
      <div class="dialog-actions"><button class="button button-outline" data-action="close-podium">Keep playing</button><button class="button button-dark" data-action="new-night">Start a new night ↗</button></div></div>`;
    if (!$('#game-dialog').open) $('#game-dialog').showModal();
    cue('champion');
    if (top > 0) setTimeout(() => { if (gameSession?.phase === 'podium') celebrate(180); }, 900);
  }
  function updateHouseCount() {
    const count = state.customWords.length;
    $('#house-count').textContent = count ? `${count} ${count === 1 ? 'word' : 'words'} ready to play` : 'Add your own inside jokes';
  }

  $('#player-inputs').addEventListener('input', event => {
    const player = state.players.find(p => p.id === event.target.dataset.player);
    if (!player) return;
    player.name = event.target.value.slice(0, 24);
    updateNameCount();
    save();
  });
  $('#player-inputs').addEventListener('click', event => {
    const button = event.target.closest('[data-avatar]');
    const player = button && state.players.find(p => p.id === button.dataset.avatar);
    if (!player) return;
    player.emoji = AVATARS[(AVATARS.indexOf(avatarFor(player)) + 1) % AVATARS.length];
    button.textContent = player.emoji;
    button.classList.remove('is-new');
    void button.offsetWidth;
    button.classList.add('is-new');
    cue('pop');
    save();
    renderTeams();
  });
  $('#player-count').addEventListener('change', event => changeCount(event.target.value));
  $('#count-minus').addEventListener('click', () => changeCount(state.players.length - 1));
  $('#count-plus').addEventListener('click', () => changeCount(state.players.length + 1));
  $('#team-count').addEventListener('change', async event => {
    const count = Number(event.target.value);
    if (count === state.teamCount) return;
    if (hasScores() && !await confirmAction('Changing the number of teams resets your groups and current scores. Everyone’s names will stay.')) { $('#team-count').value = state.teamCount; return; }
    state.teamCount = count;
    clearTeams();
    renderCrewResult();
    save();
  });
  $('#shuffle-teams').addEventListener('click', () => shuffleTeams());
  $('#reshuffle-teams').addEventListener('click', () => shuffleTeams(false));
  $('#hero-setup').addEventListener('click', focusSetup);
  $('#edit-players').addEventListener('click', focusSetup);
  $$('.filter').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    $$('.filter').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', item === button ? 'true' : 'false'); });
    renderGames();
  }));
  $('#game-grid').addEventListener('click', event => { const card = event.target.closest('[data-game]'); if (card) openGame(card.dataset.game); });
  $('#surprise-game').addEventListener('click', () => {
    const count = state.players.length;
    const eligible = GAMES.filter(g => g.minPlayers <= count && (!g.maxPlayers || count <= g.maxPlayers) && (filter === 'all' || filter === g.category));
    if (!eligible.length) { toast('None of these games fit your group size. Try another filter.'); return; }
    openGame(eligible[Math.floor(Math.random() * eligible.length)].id);
  });
  $('#scoreboard-list').addEventListener('click', event => {
    const button = event.target.closest('[data-score]');
    if (!button) return;
    const team = state.teams.find(t => t.id === button.dataset.team);
    if (!team) return;
    team.score = Math.max(0, Math.min(9999, team.score + Number(button.dataset.score)));
    save(); renderScoreboard();
    toast(`${team.name}: ${team.score} ${team.score === 1 ? 'point' : 'points'}`);
  });
  $('#reset-scores').addEventListener('click', async () => {
    if (!hasScores()) { toast('A clean slate. All teams are already on zero.'); return; }
    if (!await confirmAction('This clears every team’s score and the round history. Your teams and player names stay.', 'Reset the scoreboard?', 'Reset scores')) return;
    state.teams.forEach(t => { t.score = 0; });
    state.history = []; state.nextTeam = 0;
    save(); renderScoreboard(); renderTeams(); toast('Fresh scores. May the best team win!');
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-action="setup"]')) focusSetup();
    if (!event.target.closest('[data-sound-toggle]')) return;
    state.soundEnabled = !state.soundEnabled;
    sound.setEnabled(state.soundEnabled);
    if (state.soundEnabled) Promise.resolve(sound.unlock()).then(ok => { if (ok) sound.play('reveal'); }).catch(() => {});
    renderSoundControls();
    save();
    toast(state.soundEnabled ? 'Sound on. Let the beeps begin.' : 'Sound off. Quiet mode, same fun.');
  });
  // Browsers only allow audio after a user gesture, so unlock on the first press or key.
  ['pointerdown', 'keydown'].forEach(type => document.addEventListener(type, unlockSound, true));
  document.addEventListener('input', event => {
    if (!event.target.matches('[data-sound-volume]')) return;
    state.volume = Math.max(0, Math.min(1, Number(event.target.value) || 0));
    sound.setVolume(state.volume);
    renderSoundControls();
    save();
  });
  document.addEventListener('change', event => { if (event.target.matches('[data-sound-volume]')) cue('tick'); });
  // Host shortcuts press whichever matching button is on screen, so they can never do more than a tap could.
  const shortcuts = { g: ['correct-prompt', 'five-go', 'five-stop', 'lights-up', 'bomb-start', 'bomb-pass'], arrowright: ['correct-prompt', 'next-prompt', 'lights-up'], s: ['skip-prompt'], arrowleft: ['skip-prompt'], y: ['five-hit'], n: ['five-miss', 'next-prompt'], p: ['pause-round'] };
  document.addEventListener('keydown', event => {
    if (!['playing', 'spotlight', 'trivia'].includes(gameSession?.phase) || !$('#game-dialog').open || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest?.('input, select, textarea') || $('#confirm-dialog').open) return;
    if (gameSession.phase === 'trivia') { if (triviaController?.handleKey(event.key)) event.preventDefault(); return; }
    const target = (shortcuts[event.key.toLowerCase()] || []).map(action => $(`#game-content [data-action="${action}"]`)).find(Boolean);
    if (!target) return;
    event.preventDefault();
    target.click();
  });
  $('#crown-champions').addEventListener('click', openPodium);
  $('#house-input').addEventListener('input', event => {
    state.customWords = parseHouseWords(event.target.value);
    [...decks.keys()].filter(key => key.endsWith('|house')).forEach(key => decks.delete(key));
    updateHouseCount();
    save();
  });
  // Tidy the list (trim, drop repeats) once the host leaves the box.
  $('#house-input').addEventListener('change', event => { event.target.value = state.customWords.join('\n'); });
  function react(emoji) {
    if (!REACTIONS.some(([known]) => known === emoji)) return;
    for (let i = 0; i < 3; i += 1) window.GameNightEffects?.floatEmoji($('#game-dialog'), emoji);
    cue('pop');
  }
  // Names typed on a game's rules screen are the same names as on the guest list.
  $('#game-content').addEventListener('input', event => {
    const player = event.target.dataset?.namePlayer && state.players.find(p => p.id === event.target.dataset.namePlayer);
    if (!player) return;
    player.name = event.target.value.slice(0, 24);
    const field = $(`#player-inputs [data-player="${player.id}"]`);
    if (field) field.value = player.name;
    updateNameCount();
    save();
    renderTeams();
    renderScoreboard();
  });
  $('#game-content').addEventListener('change', event => {
    if (gameSession?.phase !== 'rules') return;
    if (['game-category', 'game-level'].includes(event.target.id)) {
      state.gameOptions[gameSession.game.id] = { category: $('#game-category')?.value || 'all', mode: $('#game-level')?.value || 'auto' };
      save();
    }
    updateLevelPreview();
  });
  $('#game-content').addEventListener('click', event => {
    const reaction = event.target.closest('[data-react]');
    if (reaction) { react(reaction.dataset.react); return; }
    const actor = event.target.closest('[data-actor]');
    if (actor) { pickActor(actor.dataset.actor); return; }
    const vote = event.target.closest('[data-vote]');
    if (vote) { voteLikely(vote.dataset.vote); return; }
    const blamed = event.target.closest('[data-blame]');
    if (blamed) { blame(blamed.dataset.blame); return; }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'start-round') startRound();
    else if (action === 'lights-up') lightsUp();
    else if (action === 'start-phones') startPhones(gameSession.game);
    else if (action === 'add-players') { closeGame(); focusSetup(); }
    else if (action === 'pause-round') pauseRound();
    else if (action === 'correct-prompt') advancePrompt(true);
    else if (action === 'skip-prompt' || action === 'next-prompt') advancePrompt(false);
    else if (action === 'five-go') startFiveSecond();
    else if (action === 'five-stop') stopFiveSecond();
    else if (action === 'five-hit' || action === 'five-miss') judgeFiveSecond(action === 'five-hit');
    else if (action === 'finish-round') finishRound();
    else if (action === 'next-round' || action === 'replay-match') startRound({ duration: gameSession.duration, category: gameSession.category, mode: gameSession.mode });
    else if (action === 'next-turn' && gameSession.match) { gameSession.match.turn += 1; startRound({ duration: gameSession.duration, category: gameSession.category, mode: gameSession.mode, match: gameSession.match }); }
    else if (action === 'standings') renderStandings();
    else if (action === 'next-level' && gameSession.match) { const m = gameSession.match; m.levelIndex += 1; m.turn = 0; startRound({ duration: gameSession.duration, category: gameSession.category, mode: gameSession.mode, match: m }); }
    else if (action === 'final') renderFinal();
    else if (action === 'peek' && gameSession.phase === 'playing') { gameSession.peek = !gameSession.peek; renderRound(); }
    else if (action === 'bomb-start') lightFuse();
    else if (action === 'bomb-pass') passBomb();
    else if (action === 'close-podium') closeGame();
    else if (action === 'new-night') { closeGame(); $('#reset-scores').click(); }
    else if (action === 'back-games') { closeGame(); location.hash = 'games'; }
    else if (action === 'view-scores') { closeGame(); location.hash = 'scoreboard'; }
  });
  $('#close-game').addEventListener('click', closeGame);
  $('#game-dialog').addEventListener('cancel', event => { event.preventDefault(); closeGame(); });
  $('#game-dialog').addEventListener('click', event => {
    if (event.target !== $('#game-dialog')) return;
    const rect = $('#game-dialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeGame();
  });
  document.addEventListener('visibilitychange', () => {
    imposterController?.handleVisibility(document.hidden);
    triviaController?.handleVisibility(document.hidden);
    if (document.hidden && gameSession?.phase === 'playing' && gameSession.duration && !gameSession.paused) pauseRound();
  });
  window.addEventListener('hashchange', () => { route(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  window.addEventListener('pagehide', () => {
    if (gameSession?.phase === 'playing' && gameSession.team) finishRound();
    if (endTriviaEarly()) stopControllers();
  });
  $('#house-input').value = state.customWords.join('\n');
  updateHouseCount();
  renderGames(); renderRoster(); renderSoundControls(); route();
  $('#save-status').textContent = storageAvailable ? 'Your night is saved on this device' : 'Playing in memory · browser saving unavailable';
})();
