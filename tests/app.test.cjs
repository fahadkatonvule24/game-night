'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
const coreSource = fs.readFileSync(path.join(root, 'core.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const imposterSource = fs.readFileSync(path.join(root, 'imposter.js'), 'utf8');
const triviaSource = fs.readFileSync(path.join(root, 'trivia.js'), 'utf8');
const banterSource = fs.readFileSync(path.join(root, 'banter.js'), 'utf8');
const phoneSource = fs.readFileSync(path.join(root, 'phonehost.js'), 'utf8');
const STORAGE_KEY = 'game-night-v1';

// This harness evaluates local source in an in-memory DOM. It does not launch,
// connect to, or control a browser, and it does not load external resources.
function setup(t, savedState) {
  const dom = new JSDOM(html, { url: 'http://localhost:3000/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const document = window.document;
  const errors = [];
  let now = 0;
  let timerId = 0;
  const intervals = new Map();
  const timeouts = new Map();

  window.addEventListener('error', event => { errors.push(event.error); event.preventDefault(); });
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.scrollTo = () => {};
  window.matchMedia = query => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
  Object.defineProperty(window.performance, 'now', { value: () => now, configurable: true });
  window.Math.random = () => 0.999999;
  window.setInterval = callback => { intervals.set(++timerId, callback); return timerId; };
  window.clearInterval = id => intervals.delete(id);
  window.setTimeout = callback => { timeouts.set(++timerId, callback); return timerId; };
  window.clearTimeout = id => timeouts.delete(id);
  if (savedState !== undefined) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
  window.eval(coreSource);
  window.eval(imposterSource);
  window.eval(triviaSource);
  window.eval(banterSource);
  window.eval(phoneSource);
  window.eval(appSource);

  const query = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  function required(selector) {
    const element = query(selector);
    assert.ok(element, `Expected an element matching ${selector}`);
    return element;
  }
  const click = selector => required(selector).click();
  function setValue(selector, value, type = 'change') {
    const element = required(selector);
    element.value = String(value);
    element.dispatchEvent(new window.Event(type, { bubbles: true }));
  }
  function advance(milliseconds) {
    now += milliseconds;
    for (const [id, callback] of [...intervals]) if (intervals.has(id)) callback();
  }
  function route(name) {
    window.location.hash = name;
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  }
  function openGame(id) {
    route('games');
    click(`[data-game="${id}"]`);
    assert.equal(query('#game-dialog').open, true);
  }
  function startGame(id, duration) {
    openGame(id);
    if (duration !== undefined) setValue('#round-duration', duration);
    click('[data-action="start-round"]');
    lightsUp();
  }
  // Team games open on a spotlight screen; this starts the clock like the host would.
  function lightsUp() {
    if (query('[data-action="lights-up"]')) click('[data-action="lights-up"]');
  }
  function state() { return JSON.parse(window.localStorage.getItem(STORAGE_KEY)); }
  t.after(() => {
    dom.window.close();
    assert.deepEqual(errors, [], 'Application should not throw an uncaught DOM event error');
  });
  return { window, document, query, all, click, setValue, advance, route, openGame, startGame, lightsUp, state, intervals };
}

const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

test('guest input produces seven unique players in three balanced teams and safely renders names', t => {
  const app = setup(t);
  assert.equal(app.all('[data-player]').length, 6);
  app.setValue('#player-count', 7);
  assert.equal(app.all('[data-player]').length, 7);
  app.setValue('[data-player="player-1"]', '<img src=x onerror=x>', 'input');
  app.setValue('[data-player="player-2"]', 'Amina', 'input');
  app.setValue('[data-player="player-3"]', 'Sam & Jo', 'input');
  app.setValue('#team-count', 3);
  app.click('#shuffle-teams');

  const state = app.state();
  assert.equal(state.players.length, 7);
  assert.equal(state.teamCount, 3);
  assert.deepEqual(state.teams.map(team => team.players.length), [3, 2, 2]);
  assert.deepEqual(state.teams.flatMap(team => team.players.map(player => player.id)).sort(), state.players.map(player => player.id).sort());
  assert.equal(new Set(state.teams.flatMap(team => team.players.map(player => player.id))).size, 7);
  assert.match(app.query('#team-cards').textContent, /<img src=x onerror=x>/);
  assert.match(app.query('#team-cards').textContent, /Sam & Jo/);
  assert.match(app.query('#team-cards').textContent, /Player 7/);
  assert.equal(app.query('#team-cards img'), null);
  assert.equal(app.query('#team-cards [onerror]'), null);
  assert.equal(app.query('#name-count').textContent, '3 / 7 named');
  app.setValue('#player-count', 41);
  assert.equal(app.query('#player-count').value, '7');
  assert.equal(app.state().players.length, 7);
});

test('saved names, balanced groups and manual scores restore into a new app session', t => {
  const first = setup(t);
  first.setValue('[data-player="player-1"]', 'Fahad', 'input');
  first.setValue('[data-player="player-2"]', 'Nia', 'input');
  first.click('#shuffle-teams');
  first.route('scoreboard');
  first.click('[data-score="1"][data-team="team-1"]');
  first.click('[data-score="1"][data-team="team-1"]');
  const saved = first.state();

  const restored = setup(t, saved);
  assert.equal(restored.query('[data-player="player-1"]').value, 'Fahad');
  assert.equal(restored.query('[data-player="player-2"]').value, 'Nia');
  assert.equal(restored.query('#team-count').value, '2');
  assert.equal(restored.all('.team-card').length, 2);
  restored.route('scoreboard');
  assert.match(restored.query('.score-row').textContent, /Team Tangerine/);
  assert.match(restored.query('.score-row .score-value').textContent, /^2/);
  assert.deepEqual(restored.state(), saved);
  restored.click('[data-score="-1"][data-team="team-1"]');
  assert.equal(restored.state().teams[0].score, 1);
});

test('Would You Rather advances multiple dilemmas without a timer or score', t => {
  const app = setup(t);
  app.startGame('would-you-rather');
  const firstChoices = app.query('.choice-options').textContent;
  assert.equal(app.query('#round-clock'), null);
  assert.equal(app.intervals.size, 0);
  app.advance(600000);
  app.click('[data-action="next-prompt"]');
  assert.notEqual(app.query('.choice-options').textContent, firstChoices);
  assert.match(app.query('.round-stats').textContent, /CONVERSATION 2/);
  app.click('[data-action="next-prompt"]');
  assert.match(app.query('.round-stats').textContent, /CONVERSATION 3/);
  assert.equal(app.query('.summary'), null);
  app.click('[data-action="finish-round"]');
  assert.match(app.query('.summary').textContent, /3 dilemmas/);
  assert.equal(app.state(), null);
});

test('Charades scores, skips, pauses, times out once, and rotates to the next team', t => {
  const app = setup(t);
  app.startGame('charades', 15);
  assert.equal(app.query('#round-clock').textContent, '0:15');
  assert.match(app.query('.round-team').textContent, /Team Tangerine/);
  const firstPrompt = app.query('.prompt-text').textContent;
  app.click('[data-action="correct-prompt"]');
  assert.notEqual(app.query('.prompt-text').textContent, firstPrompt);
  app.click('[data-action="correct-prompt"]');
  app.click('[data-action="skip-prompt"]');
  assert.match(app.query('.round-stats').textContent, /2 POINTS THIS ROUND/);
  assert.match(app.query('.round-stats').textContent, /1 SKIPPED/);
  app.advance(4000);
  assert.equal(app.query('#round-clock').textContent, '0:11');
  app.click('[data-action="pause-round"]');
  assert.ok(app.query('.round-pause'));
  assert.equal(app.query('.prompt-card'), null);
  app.advance(60000);
  assert.equal(app.query('#round-clock').textContent, '0:11');
  app.click('[data-action="pause-round"]');
  assert.ok(app.query('.prompt-card'));
  app.advance(10999);
  assert.equal(app.query('#round-clock').textContent, '0:01');
  assert.equal(app.query('.summary'), null);
  app.advance(1);
  assert.ok(app.query('.summary'));
  assert.equal(app.state().teams[0].score, 2);
  assert.equal(app.state().history.length, 1);
  assert.equal(app.state().history[0].points, 2);
  assert.equal(app.state().nextTeam, 1);
  app.advance(30000);
  assert.equal(app.state().teams[0].score, 2);
  assert.equal(app.state().history.length, 1);
  assert.equal(app.intervals.size, 0);
  app.click('[data-action="next-turn"]');
  app.lightsUp();
  assert.match(app.query('.round-team').textContent, /Team Mint/);
  assert.equal(app.query('#round-clock').textContent, '0:15');
});

// Finds the tile holding the right answer for the question on screen. Choices are shuffled per game.
function triviaTiles(app) {
  const text = app.query('.tv-question-text').textContent;
  const question = app.window.GameNightCore.getGame('trivia').prompts.find(prompt => prompt.text === text);
  assert.ok(question, `Unknown question: ${text}`);
  const tiles = app.all('.tv-tile');
  const right = tiles.findIndex(tile => tile.querySelector('.tv-tile-text').textContent === question.options[question.answer]);
  return { question, tiles, right, wrong: (right + 1) % 4 };
}

// Plays one team round. plan(n) returns 'right', 'wrong', 'pass' or 'timeout' for question n (1–10).
function playTriviaRound(app, plan, seen = []) {
  app.click('[data-trivia-action="start-team"]');
  for (let n = 1; n <= 10; n += 1) {
    assert.match(app.query('.tv-question-meta').textContent, new RegExp(`QUESTION ${n} OF 10`));
    const { question, tiles, right, wrong } = triviaTiles(app);
    seen.push(question);
    const move = plan(n);
    if (move === 'pass') app.click('[data-trivia-action="skip"]');
    else if (move === 'timeout') app.advance(120000);
    else { tiles[move === 'right' ? right : wrong].click(); app.advance(1000); }
    assert.equal(app.query('[data-trivia-phase]').dataset.triviaPhase, 'reveal');
    app.click('[data-trivia-action="next-question"]');
    if (n === 5) app.click('[data-trivia-action="end-huddle"]');
  }
  assert.equal(app.query('[data-trivia-phase]').dataset.triviaPhase, 'team-done');
  return seen;
}

test('Trivia gives a team its own ten-question round with a halftime huddle, then the next team is up', t => {
  const app = setup(t);
  app.openGame('trivia');
  assert.equal(app.query('#playing-team'), null, 'every team plays, so there is no team picker');
  assert.match(app.query('#game-level option[value="auto"]').textContent, /All three · Easy → Medium → Hard/);
  assert.match(app.query('#level-preview').textContent, /10 questions per level.*60 questions across 2 teams/);
  app.setValue('#round-duration', 15);
  app.click('[data-action="start-round"]');
  app.lightsUp();
  const phase = () => app.query('[data-trivia-phase]').dataset.triviaPhase;
  assert.ok(app.query('#game-dialog').classList.contains('stage-mode'));
  assert.equal(phase(), 'level-intro');
  assert.equal(app.query('#dialog-title').textContent, 'Level 1');
  assert.equal(app.query('.tv-stamp').textContent, 'Easy');
  assert.equal(app.all('.tv-marquee i').length, 22);

  app.click('[data-trivia-action="begin-level"]');
  assert.equal(phase(), 'team-intro');
  const team = app.state().teams[0];
  assert.equal(app.query('.tv-team-name').textContent, team.name);
  assert.equal(app.all('.tv-seat').length, 3);
  assert.equal(app.query('.tv-seat.is-up').dataset.triviaPlayer, team.players[0].id);

  app.click('[data-trivia-action="start-team"]');
  assert.equal(phase(), 'question');
  assert.equal(app.query('[data-trivia-clock] span').textContent, '0:15');
  assert.equal(app.all('.tv-tile').length, 4);
  assert.equal(app.all('.tv-dot').length, 10);

  let pick = triviaTiles(app);
  assert.equal(pick.question.difficulty, 'easy');
  pick.tiles[pick.right].click();
  assert.equal(phase(), 'locking', 'a short drum roll before the reveal');
  assert.equal(app.all('.tv-tile:disabled').length, 4);
  app.advance(1000);
  assert.match(app.query('.tv-verdict').textContent, /Correct!/);
  assert.equal(app.state().teams[0].score, 1, 'points reach the scoreboard straight away');
  assert.equal(app.query('.tv-hud-score b').textContent, '1');
  app.query('.tv-tile').dispatchEvent(new app.window.MouseEvent('click', { bubbles: true }));
  assert.equal(app.state().teams[0].score, 1);

  app.click('[data-trivia-action="next-question"]');
  pick = triviaTiles(app);
  pick.tiles[pick.wrong].click();
  app.advance(1000);
  assert.match(app.query('.tv-verdict').textContent, /Oh no!.*The answer was/);
  app.click('[data-trivia-action="next-question"]');
  app.advance(15000);
  assert.match(app.query('.tv-verdict').textContent, /Time’s up!/);
  app.click('[data-trivia-action="next-question"]');
  app.click('[data-trivia-action="skip"]');
  assert.match(app.query('.tv-verdict').textContent, /Passed/);
  app.click('[data-trivia-action="next-question"]');
  pick = triviaTiles(app);
  pick.tiles[pick.right].click();
  app.advance(1000);
  assert.match(app.query('[data-trivia-primary]').textContent, /Halftime huddle/);
  assert.deepEqual(app.all('.tv-dot').slice(0, 5).map(dot => dot.className.match(/tv-dot-(\w+)/)[1]), ['right', 'wrong', 'timeout', 'passed', 'right']);

  app.click('[data-trivia-action="next-question"]');
  assert.equal(phase(), 'huddle');
  assert.match(app.query('.tv-huddle').textContent, /Change who’s up\?/);
  assert.equal(app.query('[data-trivia-clock] span').textContent, '2:00');
  app.click(`[data-trivia-player="${team.players[1].id}"]`);
  assert.equal(app.query('.tv-seat.is-up').dataset.triviaPlayer, team.players[1].id);
  app.advance(60000);
  assert.equal(app.query('[data-trivia-clock] span').textContent, '1:00');
  app.advance(60000);
  assert.equal(phase(), 'question', 'when the huddle clock runs out, play carries on');
  assert.match(app.query('#toast').textContent, /must finish the round/);
  assert.match(app.query('.tv-hud-team small').textContent, new RegExp(`${team.players[1].name}.*locked in`));
  assert.match(app.query('.tv-question-meta').textContent, /QUESTION 6 OF 10/);
  assert.equal(app.query('[data-trivia-player]'), null, 'no more swaps after halftime');

  for (let n = 6; n <= 10; n += 1) {
    pick = triviaTiles(app);
    pick.tiles[pick.right].click();
    app.advance(1000);
    app.click('[data-trivia-action="next-question"]');
  }
  assert.equal(phase(), 'team-done');
  assert.equal(app.query('.tv-big-score').textContent, '+7');
  assert.match(app.query('.tv-team-done').textContent, /7 of 10 right on Easy/);
  assert.equal(app.state().teams[0].score, 7);
  assert.deepEqual(app.state().history.map(h => [h.gameId, h.teamId, h.points]), [['trivia', team.id, 7]]);
  const next = app.state().teams[1];
  assert.match(app.query('[data-trivia-primary]').textContent, new RegExp(`Up next: ${next.name}`));
  app.click('[data-trivia-action="next-team"]');
  assert.equal(app.query('.tv-team-name').textContent, next.name);
});

test('Trivia climbs Easy to Hard, every team plays each level, and points grow with the level', t => {
  const app = setup(t);
  app.openGame('trivia');
  app.setValue('#game-category', 'capitals');
  app.click('[data-action="start-round"]');
  app.lightsUp();
  const seen = [];
  const levels = ['easy', 'medium', 'hard'];
  levels.forEach((level, i) => {
    assert.equal(app.query('#dialog-title').textContent, `Level ${i + 1}`);
    app.click('[data-trivia-action="begin-level"]');
    for (let team = 0; team < 2; team += 1) {
      const players = app.state().teams[team].players;
      assert.equal(app.query('.tv-seat.is-up').dataset.triviaPlayer, players[i % players.length].id, 'a new player starts each level');
      playTriviaRound(app, n => (team === 0 ? 'right' : n <= 2 ? 'right' : 'pass'), seen);
      app.click('[data-trivia-action="next-team"]');
    }
    assert.equal(app.query('[data-trivia-phase]').dataset.triviaPhase, 'level-done');
    assert.equal(app.all('.tv-standings li').length, 2);
    assert.match(app.query('[data-trivia-primary]').textContent, i < 2 ? new RegExp(`On to Level ${i + 2}`) : /The final results/);
    app.click('[data-trivia-action="next-level"]');
  });
  assert.equal(seen.length, 60);
  assert.equal(new Set(seen.map(q => q.text)).size, 60, 'no question repeats in one show');
  levels.forEach((level, i) => {
    const block = seen.slice(i * 20, i * 20 + 20);
    assert.ok(block.every(q => q.difficulty === level), `level ${i + 1} only asks ${level} questions`);
    assert.ok(block.slice(0, 10).every(q => q.category === 'capitals'), 'the first team gets the chosen category');
  });
  const [first, second] = app.state().teams;
  assert.equal(first.score, 10 + 20 + 30);
  assert.equal(second.score, 2 + 4 + 6);
  assert.equal(app.query('[data-trivia-phase]').dataset.triviaPhase, 'final');
  assert.equal(app.query('#dialog-title').textContent, `${first.name} wins Trivia Night!`);
  assert.equal(app.state().history.length, 6);
  app.click('[data-trivia-action="replay"]');
  assert.equal(app.query('#dialog-title').textContent, 'Level 1');
  app.click('#close-game');
  assert.equal(app.query('#game-dialog').open, false);
  assert.equal(app.intervals.size, 0);
});

test('a fixed Trivia level plays one round per team, and closing mid-round keeps the points won', t => {
  const app = setup(t);
  app.openGame('trivia');
  app.setValue('#game-level', 'hard');
  assert.match(app.query('#level-preview').textContent, /Hard · 3 pt.*20 questions across 2 teams/);
  app.click('[data-action="start-round"]');
  app.lightsUp();
  assert.equal(app.query('.tv-stamp').textContent, 'Hard');
  app.click('[data-trivia-action="begin-level"]');
  app.click('[data-trivia-action="start-team"]');
  assert.match(app.query('.tv-question-meta').textContent, /3 pts/);
  const pick = triviaTiles(app);
  pick.tiles[pick.right].click();
  app.advance(1000);
  assert.equal(app.state().teams[0].score, 3);
  app.click('#close-game');
  assert.equal(app.query('#game-dialog').open, false);
  assert.match(app.query('#toast').textContent, /Every point won is on the board/);
  assert.deepEqual(app.state().history.map(h => h.points), [3]);
  assert.equal(app.state().nextTeam, 1);
  assert.equal(app.intervals.size, 0);
  app.openGame('trivia');
  assert.equal(app.query('#game-level').value, 'hard', 'the level choice is remembered');
  assert.match(app.query('.auto-team-note').textContent, new RegExp(`starting with ${app.state().teams[1].name}`));
});

test('Trivia host keys answer, pass, pause and advance, and nothing scores while paused', t => {
  const app = setup(t);
  const press = key => app.document.body.dispatchEvent(new app.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  app.startGame('trivia', 15);
  press('a');
  assert.equal(app.query('[data-trivia-phase]').dataset.triviaPhase, 'level-intro', 'answer keys do nothing before a question');
  press('n');
  press('ArrowRight');
  assert.equal(app.query('[data-trivia-phase]').dataset.triviaPhase, 'question');
  assert.match(app.query('.tv-keys').textContent, /answer/);
  press('p');
  assert.match(app.query('.tv-question-text').textContent, /Paused/);
  assert.equal(app.query('.tv-tile'), null);
  app.advance(60000);
  press('a');
  assert.equal(app.query('[data-trivia-phase]').dataset.triviaPhase, 'question');
  press('p');
  assert.equal(app.query('[data-trivia-clock] span').textContent, '0:15', 'the clock waited during the pause');
  const { right } = triviaTiles(app);
  press('abcd'[right]);
  app.advance(1000);
  assert.match(app.query('.tv-verdict').textContent, /Correct!/);
  press('n');
  press('s');
  assert.match(app.query('.tv-verdict').textContent, /Passed/);
  assert.equal(app.state().teams[0].score, 1);
});

test('one-person teams can play Trivia and skip the swap at halftime', t => {
  const app = setup(t);
  app.setValue('#player-count', 4);
  app.setValue('#team-count', 4);
  app.openGame('trivia');
  app.click('[data-action="start-round"]');
  app.lightsUp();
  assert.ok(app.state().teams.every(team => team.players.length === 1));
  app.click('[data-trivia-action="begin-level"]');
  assert.match(app.query('.tv-team-intro').textContent, /flying solo/);
  app.click('[data-trivia-action="start-team"]');
  for (let n = 1; n <= 5; n += 1) { app.click('[data-trivia-action="skip"]'); app.click('[data-trivia-action="next-question"]'); }
  assert.match(app.query('.tv-huddle').textContent, /Catch your breath/);
  assert.equal(app.query('[data-trivia-player]'), null);
});

test('performance games require teammates, while Trivia permits one-person teams', t => {
  const app = setup(t);
  app.setValue('#player-count', 4);
  app.setValue('#team-count', 4);
  for (const gameId of ['charades', 'taboo', 'quickdraw']) {
    app.openGame(gameId);
    assert.equal(app.query('[data-action="start-round"]'), null);
    assert.match(app.query('.auto-team-note').textContent, /at least two people/);
    assert.match(app.query('[data-action="add-players"]').textContent, /Adjust your teams/);
    app.click('#close-game');
  }
  app.openGame('trivia');
  assert.ok(app.query('[data-action="start-round"]'));
  app.click('[data-action="start-round"]');
  app.lightsUp();
  assert.ok(app.state().teams.every(team => team.players.length === 1));
  assert.ok(app.query('.tv-show'));
});

test('score reset cancellation preserves progress, then confirmation clears scores and history only', async t => {
  const app = setup(t);
  app.setValue('[data-player="player-1"]', 'Amina', 'input');
  app.startGame('charades', 15);
  app.click('[data-action="correct-prompt"]');
  app.click('[data-action="finish-round"]');
  app.click('[data-action="view-scores"]');
  const before = app.state();
  assert.equal(before.teams[0].score, 1);
  assert.equal(before.history.length, 1);
  app.click('#reset-scores');
  assert.equal(app.query('#confirm-dialog').open, true);
  app.click('#confirm-cancel');
  await settle();
  assert.equal(app.query('#confirm-dialog').open, false);
  assert.deepEqual(app.state(), before);
  app.click('#reset-scores');
  app.click('#confirm-accept');
  await settle();
  const after = app.state();
  assert.ok(after.teams.every(team => team.score === 0));
  assert.deepEqual(after.history, []);
  assert.equal(after.nextTeam, 0);
  assert.deepEqual(after.players, before.players);
  assert.deepEqual(after.teams.map(team => team.players), before.teams.map(team => team.players));
});

test('a Charades match plays every team at Easy, Medium and Hard, then crowns a champion', t => {
  const app = setup(t);
  app.openGame('charades');
  app.setValue('#game-category', 'capitals');
  assert.match(app.query('#level-preview').textContent, /Easy · 1 pt.*Medium · 2 pts.*Hard · 3 pts.*6 turns, then we crown a champion/);
  app.setValue('#round-duration', 15);
  app.click('[data-action="start-round"]');
  const core = app.window.GameNightCore.getGame('charades').prompts;
  const pool = level => core.filter(p => p.category === 'capitals' && p.difficulty === level).map(p => p.text);
  const [first, second] = app.state().teams;
  const levels = ['easy', 'medium', 'hard'];
  levels.forEach((level, i) => {
    for (const team of [first, second]) {
      assert.match(app.query('.tv-kicker').textContent, new RegExp(`LEVEL ${i + 1} OF 3 · ${level.toUpperCase()}`));
      app.lightsUp();
      assert.match(app.query('.round-team').textContent, new RegExp(team.name));
      assert.ok(pool(level).includes(app.query('.prompt-text').textContent), `${level} prompts only`);
      assert.ok(app.query('[data-action="correct-prompt"]').textContent.includes(`+${i + 1}`), 'harder levels are worth more');
      if (team === first) app.click('[data-action="correct-prompt"]');
      app.advance(15000);
      assert.ok(app.query('.summary'), 'the clock ends every turn');
      if (team === first) app.click('[data-action="next-turn"]');
    }
    if (i < 2) {
      app.click('[data-action="standings"]');
      assert.match(app.query('#dialog-title').textContent, new RegExp(`${first.name} leads the way!`));
      assert.equal(app.all('.tv-standings li').length, 2);
      app.click('[data-action="next-level"]');
    }
  });
  assert.match(app.query('[data-action="final"]').textContent, /Final results/);
  app.click('[data-action="final"]');
  assert.equal(app.query('#dialog-title').textContent, `${first.name} wins Charades!`);
  assert.equal(app.state().teams[0].score, 1 + 2 + 3);
  assert.equal(app.state().history.length, 6);
  assert.deepEqual(app.state().gameOptions.charades, { category: 'capitals', mode: 'auto' });
  app.click('[data-action="replay-match"]');
  assert.match(app.query('.tv-kicker').textContent, /LEVEL 1 OF 3 · EASY/);
  app.click('#close-game');
  const restored = setup(t, app.state());
  restored.openGame('charades');
  assert.equal(restored.query('#game-category').value, 'capitals');
  assert.equal(restored.query('#game-level').value, 'auto');
});

test('right answers and skips get automatic host comments and emojis', t => {
  const app = setup(t);
  const floats = [];
  app.window.GameNightEffects = { floatEmoji: (target, emoji) => { floats.push(emoji); return true; }, confetti() { return false; }, clear() {} };
  app.startGame('charades', 30);
  assert.equal(app.query('.tv-quip'), null);
  app.click('[data-action="correct-prompt"]');
  const actor = app.query('.round-team small').textContent.replace(/ acts$/, '');
  const banter = app.window.GameNightBanter;
  assert.ok(app.query('.tv-quip').textContent.length > 4);
  assert.ok(floats.length >= 2 && floats.every(e => banter.emojis('right').includes(e)));
  floats.length = 0;
  app.click('[data-action="skip-prompt"]');
  assert.ok(floats.every(e => banter.emojis('skip').includes(e)) && floats.length > 0);
  for (let i = 0; i < 20; i += 1) assert.doesNotMatch(banter.line('right', { name: actor }), /\{name\}/);
});

test('a fixed Hard level serves only hard prompts and never levels up', t => {
  const app = setup(t);
  app.openGame('charades');
  app.setValue('#game-category', 'capitals');
  app.setValue('#game-level', 'hard');
  assert.match(app.query('#level-preview').textContent, /Hard/);
  app.click('[data-action="start-round"]');
  app.lightsUp();
  const hard = app.window.GameNightCore.getGame('charades').prompts.filter(p => p.category === 'capitals' && p.difficulty === 'hard').map(p => p.text);
  assert.ok(hard.includes(app.query('.prompt-text').textContent));
  assert.match(app.query('.level-row').textContent, /3 points each/);
  app.advance(60000);
  assert.match(app.query('[data-action="next-turn"]').textContent, /Up next/);
  app.click('[data-action="next-turn"]');
  app.lightsUp();
  app.advance(60000);
  assert.ok(app.query('[data-action="final"]'), 'one level means one turn per team, then the final');
});

test('Five-Second Challenge waits for the start tap, buzzes after five seconds, and is judged by the room', t => {
  const app = setup(t);
  app.openGame('five-second');
  assert.equal(app.query('#round-duration'), null);
  app.click('[data-action="start-round"]');
  app.lightsUp();
  assert.match(app.query('.prompt-text').textContent, /^Name three /);
  assert.equal(app.query('#round-clock').textContent, '0:05');
  app.advance(10000);
  assert.equal(app.query('#round-clock').textContent, '0:05', 'the clock waits for Start');
  app.click('[data-action="five-go"]');
  app.advance(2000);
  assert.equal(app.query('#round-clock').textContent, '0:03');
  assert.ok(app.query('[data-action="five-stop"]'));
  app.advance(3000);
  assert.ok(app.query('[data-action="five-hit"]'));
  assert.equal(app.query('.summary'), null, 'the buzzer ends the prompt, not the turn');
  app.click('[data-action="five-hit"]');
  assert.match(app.query('.round-stats').textContent, /1 POINT THIS ROUND/);
  assert.ok(app.query('[data-action="five-go"]'));
  app.click('[data-action="five-go"]');
  app.click('[data-action="five-stop"]');
  app.click('[data-action="five-miss"]');
  assert.match(app.query('.round-stats').textContent, /1 MISSED/);
  app.click('[data-action="finish-round"]');
  assert.equal(app.state().teams[0].score, 1);
  assert.equal(app.state().history[0].points, 1);
});

test('Who Am I? needs teammates and plays like a timed team round', t => {
  const app = setup(t);
  app.setValue('#player-count', 4);
  app.setValue('#team-count', 4);
  app.openGame('who-am-i');
  assert.equal(app.query('[data-action="start-round"]'), null);
  app.click('#close-game');
  app.setValue('#team-count', 2);
  app.openGame('who-am-i');
  app.setValue('#game-category', 'characters');
  app.click('[data-action="start-round"]');
  app.lightsUp();
  assert.match(app.query('.round-team').textContent, /guesses/);
  assert.match(app.query('.tv-question-meta').textContent, /Fictional characters/);
  app.click('[data-action="correct-prompt"]');
  app.click('[data-action="finish-round"]');
  assert.equal(app.state().teams[0].score, 1);
});

test('Guess the Imposter deals private roles, collects private votes, and leaves scores alone', t => {
  const app = setup(t);
  app.setValue('#player-count', 3);
  app.setValue('[data-player="player-1"]', 'Amina', 'input');
  app.openGame('imposter');
  app.setValue('#game-category', 'food');
  app.setValue('#round-duration', 60);
  app.click('[data-action="start-round"]');
  app.lightsUp();
  let imposter = '';
  let word = '';
  for (let i = 0; i < 3; i += 1) {
    assert.match(app.query('#dialog-title').textContent, /^Pass to /);
    assert.equal(app.query('.imposter-word, .imposter-secret'), null, 'roles stay hidden until the player is ready');
    app.click('[data-imposter-action="reveal-role"]');
    const name = app.query('#dialog-title').textContent;
    if (app.query('.imposter-secret')) imposter = name;
    else word = app.query('.imposter-word .prompt-text').textContent;
    assert.match(app.query('.imposter-category').textContent, /Food/);
    app.click('[data-imposter-action="hide-role"]');
  }
  assert.ok(imposter && word);
  app.click('[data-imposter-action="start-discussion"]');
  assert.equal(app.query('.imposter-clock').textContent, '1:00');
  app.advance(60000);
  for (let i = 0; i < 3; i += 1) {
    app.click('[data-imposter-action="reveal-vote"]');
    const voter = app.query('#dialog-title').textContent.replace(/, who is it\?$/, '');
    const choices = app.all('[data-imposter-vote]');
    const pick = voter === imposter ? choices[0] : choices.find(button => button.textContent.endsWith(imposter));
    pick.click();
    app.click('[data-imposter-action="hide-vote"]');
  }
  assert.match(app.query('#dialog-title').textContent, /one last chance/);
  app.setValue('#imposter-guess', 'definitely not it', 'input');
  app.query('.imposter-guess-form').dispatchEvent(new app.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.match(app.query('#dialog-title').textContent, /The group wins!/);
  assert.ok(app.query('.imposter-result-card').textContent.includes(word));
  assert.equal(app.state().gameOptions.imposter.category, 'food');
  assert.equal(app.state().teams.length, 0, 'a group game does not create teams or points');
  app.click('[data-imposter-action="replay"]');
  assert.match(app.query('#dialog-title').textContent, /^Pass to /);
  app.click('#close-game');
  assert.equal(app.query('#game-dialog').open, false);
  assert.equal(app.query('#game-content').children.length, 0);
});

test('Guess the Imposter asks to trim a guest list larger than twelve', t => {
  const app = setup(t);
  app.setValue('#player-count', 13);
  app.openGame('imposter');
  assert.equal(app.query('[data-action="start-round"]'), null);
  assert.match(app.query('.auto-team-note').textContent, /up to 12 players/);
});

test('sound toggle and volume are remembered between visits', t => {
  const app = setup(t);
  app.click('.site-header [data-sound-toggle]');
  assert.equal(app.state().soundEnabled, false);
  assert.ok(app.all('[data-sound-toggle]').every(button => button.getAttribute('aria-pressed') === 'false'));
  app.setValue('[data-sound-volume]', 0.2, 'input');
  assert.equal(app.state().volume, 0.2);
  const restored = setup(t, app.state());
  assert.match(restored.query('.site-header [data-sound-toggle]').textContent, /Sound off/);
  assert.equal(restored.query('[data-sound-volume]').value, '0.2');
});

test('three correct in a row lights a streak that a skip puts out, and the best streak is reported', t => {
  const app = setup(t);
  app.startGame('charades', 60);
  for (let i = 0; i < 2; i += 1) app.click('[data-action="correct-prompt"]');
  assert.equal(app.query('.streak-chip'), null);
  app.click('[data-action="correct-prompt"]');
  assert.match(app.query('.streak-chip').textContent, /ON FIRE ×3/);
  app.click('[data-action="correct-prompt"]');
  assert.match(app.query('.streak-chip').textContent, /×4/);
  app.click('[data-action="skip-prompt"]');
  assert.equal(app.query('.streak-chip'), null);
  app.click('[data-action="finish-round"]');
  assert.match(app.query('.summary-details').textContent, /Best streak: 🔥 4 in a row/);
});

test('host keyboard shortcuts press only the buttons that are on screen', t => {
  const app = setup(t);
  const press = key => app.document.body.dispatchEvent(new app.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  app.startGame('charades', 60);
  assert.match(app.query('.shortcut-hint').textContent, /got it/);
  press('g'); press('ArrowRight');
  press('s');
  assert.match(app.query('.round-stats').textContent, /2 POINTS THIS ROUND/);
  assert.match(app.query('.round-stats').textContent, /1 SKIPPED/);
  press('y');
  assert.match(app.query('.round-stats').textContent, /2 POINTS/, 'Y does nothing outside Five-Second');
  press('p');
  assert.ok(app.query('.round-pause'));
  press('g');
  assert.match(app.query('.round-stats').textContent, /2 POINTS/, 'nothing scores while paused');
  press('p');
  app.click('[data-action="finish-round"]');
  press('g');
  assert.ok(app.query('.summary'));
  app.click('#close-game');

  app.startGame('five-second');
  press('g');
  assert.ok(app.query('[data-action="five-stop"]'));
  press('g');
  press('y');
  assert.match(app.query('.round-stats').textContent, /1 POINT THIS ROUND/);
  app.click('#close-game');
});

test('house words become a no-levels category in Charades, Who Am I? and the Imposter, and are saved', t => {
  const app = setup(t);
  assert.match(app.query('#house-count').textContent, /Add your own/);
  app.setValue('#house-input', '  Uncle Joe’s pilau \n\nThe office printer\nthe OFFICE printer\n' + 'x'.repeat(60), 'input');
  assert.deepEqual(app.state().customWords, ['Uncle Joe’s pilau', 'The office printer', 'x'.repeat(40)]);
  assert.match(app.query('#house-count').textContent, /3 words ready/);
  app.openGame('trivia');
  assert.equal(app.query('#game-category option[value="house"]'), null, 'Trivia needs answers, so no house words');
  app.click('#close-game');
  app.openGame('charades');
  assert.match(app.query('#game-category option[value="house"]').textContent, /House words \(3\)/);
  app.setValue('#game-category', 'house');
  assert.match(app.query('#level-preview').textContent, /House · 1 pt.*Every team gets one turn. That’s 2 turns/);
  app.click('[data-action="start-round"]');
  app.lightsUp();
  const words = new Set(app.state().customWords);
  for (let i = 0; i < 5; i += 1) {
    assert.ok(words.has(app.query('.prompt-text').textContent));
    app.click('[data-action="correct-prompt"]');
  }
  assert.match(app.query('.level-row').textContent, /House words/);
  assert.equal(app.query('.level-up-banner'), null);
  app.click('[data-action="finish-round"]');
  assert.equal(app.state().progress, undefined, 'levels live in the match, not in saved progress');
  app.click('#close-game');

  const restored = setup(t, app.state());
  assert.equal(restored.query('#house-input').value, 'Uncle Joe’s pilau\nThe office printer\n' + 'x'.repeat(40));
  restored.openGame('charades');
  assert.equal(restored.query('#game-category').value, 'house');
  restored.click('#close-game');
  restored.setValue('#house-input', '', 'input');
  restored.openGame('charades');
  assert.equal(restored.query('#game-category').value, 'all', 'an emptied list falls back to mixed');
});

test('crowning the champions ranks teams on a podium and can start a new night', async t => {
  const app = setup(t);
  app.setValue('#team-count', 3);
  app.click('#shuffle-teams');
  app.route('scoreboard');
  assert.equal(app.query('#crown-champions').hidden, false);
  app.click('#crown-champions');
  assert.match(app.query('#dialog-title').textContent, /Nobody’s on the board yet/);
  app.click('[data-action="close-podium"]');
  for (const [team, points] of [['team-1', 2], ['team-2', 5], ['team-3', 2]]) for (let i = 0; i < points; i += 1) app.click(`[data-score="1"][data-team="${team}"]`);
  app.click('#crown-champions');
  assert.match(app.query('#dialog-title').textContent, /Team Mint takes the crown!/);
  assert.deepEqual(app.all('.podium-place strong').map(el => el.textContent), ['Team Tangerine', 'Team Mint', 'Team Lavender']);
  assert.deepEqual(app.all('.podium-rank').map(el => el.textContent), ['2', '1', '2'], 'tied teams share a place');
  assert.equal(app.all('.podium-crown').filter(el => el.textContent).length, 1);
  app.click('[data-action="new-night"]');
  assert.equal(app.query('#confirm-dialog').open, true);
  app.click('#confirm-accept');
  await settle();
  assert.ok(app.state().teams.every(team => team.score === 0));
});

test('every player gets a face that can be tapped to change, and it is remembered', t => {
  const app = setup(t);
  const first = app.query('[data-avatar="player-1"]');
  assert.equal(first.textContent, '🦁');
  assert.equal(app.query('[data-avatar="player-2"]').textContent, '🐯');
  first.click();
  assert.equal(first.textContent, '🐯');
  assert.equal(app.state().players[0].emoji, '🐯');
  app.click('#shuffle-teams');
  assert.ok(app.all('.team-member-list .player-avatar').some(el => el.textContent === '🐯'));
  const saved = app.state();
  saved.players[1].emoji = '<b>';
  const restored = setup(t, saved);
  assert.equal(restored.query('[data-avatar="player-1"]').textContent, '🐯');
  assert.equal(restored.query('[data-avatar="player-2"]').textContent, '🐯', 'an unknown face falls back to the default');
  restored.click('[data-avatar="player-3"]');
  assert.equal(restored.state().players[1].emoji, undefined);
});

test('players can be named from a game screen, and the spotlight uses their names and faces', t => {
  const app = setup(t);
  app.openGame('charades');
  assert.ok(app.query('.name-crew').open, 'nobody is named yet, so the name panel starts open');
  app.setValue('[data-name-player="player-1"]', 'Amina', 'input');
  assert.equal(app.query('[data-player="player-1"]').value, 'Amina');
  assert.equal(app.state().players[0].name, 'Amina');
  assert.match(app.query('#name-count').textContent, /1 \/ 6 named/);
  app.click('[data-action="start-round"]');
  const team = app.state().teams[0];
  assert.equal(app.query('[data-stage]').dataset.stage, 'spotlight');
  assert.ok(app.query('#game-dialog').classList.contains('stage-mode'));
  assert.equal(app.query('.tv-team-name').textContent, team.name);
  assert.match(app.query('.tv-seat-heading').textContent, /Who’s acting\?/);
  assert.equal(app.all('.tv-seat').length, team.players.length);
  app.advance(90000);
  assert.equal(app.query('[data-stage]').dataset.stage, 'spotlight', 'the clock waits for the lights');
  const pick = app.all('[data-actor]')[1];
  pick.click();
  assert.equal(app.query('.tv-seat.is-up').dataset.actor, pick.dataset.actor);
  const name = app.query('.tv-seat.is-up').textContent.replace(/^\S+/, '');
  assert.match(app.query('[data-action="lights-up"]').textContent, new RegExp(`${name} acts`));
  app.document.body.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'g', bubbles: true, cancelable: true }));
  assert.equal(app.query('[data-stage]').dataset.stage, 'round');
  assert.match(app.query('.round-team').textContent, new RegExp(`${name} acts`));
  assert.equal(app.query('#round-clock').textContent, '1:00');
});

test('the performer’s face reacts to the round, and reactions float up the stage', t => {
  const app = setup(t);
  const floats = [];
  app.window.GameNightEffects = { floatEmoji: (target, emoji) => { floats.push(emoji); return true; }, confetti() { return false; }, clear() {} };
  app.startGame('charades', 30);
  const mood = () => app.query('#actor-mood').textContent;
  assert.equal(mood(), '😃');
  app.click('[data-action="correct-prompt"]');
  assert.equal(mood(), '🤩');
  app.click('[data-action="skip-prompt"]');
  assert.equal(mood(), '😅');
  app.advance(21000);
  assert.equal(mood(), '😰');
  app.advance(5000);
  assert.equal(mood(), '😱');
  assert.match(app.query('#actor-mood').getAttribute('aria-label'), /nearly out of time/);
  floats.length = 0;
  app.all('[data-react]')[1].click();
  assert.deepEqual(floats, ['😂', '😂', '😂']);
  app.click('[data-action="pause-round"]');
  assert.equal(mood(), '😴');
  app.click('[data-action="pause-round"]');
  app.advance(5000);
  assert.ok(app.query('.summary .tv-face-big'), 'the summary shows the performer’s face');
  assert.ok(app.query('[data-stage="summary"] [data-react]'));
});

test('the Imposter shows faces, and reactions only appear on shared screens', t => {
  const app = setup(t);
  app.setValue('#player-count', 3);
  app.startGame('imposter');
  assert.equal(app.query('.imposter-face').textContent.trim().length > 0, true);
  assert.equal(app.query('[data-react]'), null, 'no reactions while roles are being passed');
  for (let i = 0; i < 3; i += 1) { app.click('[data-imposter-action="reveal-role"]'); app.click('[data-imposter-action="hide-role"]'); }
  assert.ok(app.query('[data-react]'));
  app.click('[data-imposter-action="start-discussion"]');
  app.click('[data-imposter-action="start-voting"]');
  app.click('[data-imposter-action="reveal-vote"]');
  assert.ok(app.all('.imposter-vote-face').length === 2);
});

test('Trivia shows the hot-seat face with a mood that follows the answer', t => {
  const app = setup(t);
  app.startGame('trivia', 15);
  app.click('[data-trivia-action="begin-level"]');
  assert.equal(app.query('.tv-seat .tv-avatar').textContent.length > 0, true);
  app.click('[data-trivia-action="start-team"]');
  const mood = () => app.query('[data-trivia-mood]').textContent;
  assert.equal(mood(), '🤔');
  app.advance(11000);
  assert.equal(mood(), '😰');
  app.click('[data-trivia-action="skip"]');
  assert.equal(mood(), '🤷');
  assert.ok(app.query('.tv-show [data-react]'));
});

test('Emoji Decode hides the answer until the holder peeks', t => {
  const app = setup(t);
  app.openGame('emoji-decode');
  app.setValue('#game-category', 'films');
  app.click('[data-action="start-round"]');
  assert.match(app.query('.tv-seat-heading').textContent, /holding the answers/);
  app.lightsUp();
  const puzzle = app.query('.prompt-text').textContent;
  const prompt = app.window.GameNightCore.getGame('emoji-decode').prompts.find(p => p.text === puzzle);
  assert.equal(prompt.difficulty, 'easy');
  assert.doesNotMatch(app.query('.tv-prompt').textContent, new RegExp(prompt.answer));
  app.click('[data-action="peek"]');
  assert.equal(app.query('.tv-answer').textContent, prompt.answer);
  app.click('[data-action="correct-prompt"]');
  assert.equal(app.query('.tv-answer'), null, 'the next puzzle starts hidden');
  assert.match(app.query('.round-stats').textContent, /1 POINT/);
});

test('Most Likely To awards titles by name and ends after ten prompts', t => {
  const app = setup(t);
  app.setValue('[data-player="player-2"]', 'Brian', 'input');
  app.startGame('most-likely');
  assert.equal(app.query('[data-stage]').dataset.stage, 'round', 'group games skip the spotlight');
  assert.equal(app.all('[data-vote]').length, 6);
  for (let i = 0; i < 9; i += 1) {
    assert.match(app.query('.round-stats').textContent, new RegExp(`ROUND ${i + 1} OF 10`));
    app.click(`[data-vote="player-${i % 3 === 0 ? 1 : 2}"]`);
    assert.ok(app.query('.tv-quip').textContent.length > 4);
  }
  app.click('[data-action="next-prompt"]');
  assert.ok(app.query('.summary'), 'skipping the last prompt still ends the game');
  assert.match(app.query('#dialog-title').textContent, /Brian collected the most titles!/);
  assert.match(app.query('.tv-awards').textContent, /Brian.*Most likely to/);
  assert.equal(app.state().history.length, 0, 'no team points in group games');
});

test('Pass the Bomb hides the fuse, explodes, blames someone and ends after five rounds', t => {
  const app = setup(t);
  app.startGame('pass-bomb');
  assert.equal(app.query('#round-clock'), null, 'the fuse is secret');
  for (let round = 1; round <= 5; round += 1) {
    app.click('[data-action="bomb-start"]');
    app.click('[data-action="bomb-pass"]');
    assert.match(app.query('.tv-hint').textContent, /1 pass/);
    app.advance(19000);
    assert.ok(app.query('[data-action="bomb-pass"]'), 'no bomb goes off in under 20 seconds');
    app.advance(30000);
    assert.ok(app.query('.tv-bomb-card.is-boom'));
    app.click(`[data-blame="player-${round === 5 ? 2 : 1}"]`);
  }
  assert.match(app.query('#dialog-title').textContent, /Player 1 is the bomb magnet!/);
  assert.match(app.query('.tv-awards').textContent, /💣💣💣💣/);
  assert.equal(app.intervals.size, 0);
});

test('Would You Rather wraps up after ten dilemmas', t => {
  const app = setup(t);
  app.startGame('would-you-rather');
  for (let i = 1; i < 10; i += 1) app.click('[data-action="next-prompt"]');
  assert.match(app.query('[data-action="next-prompt"]').textContent, /That’s a wrap/);
  app.click('[data-action="next-prompt"]');
  assert.match(app.query('.summary-details').textContent, /10 dilemmas/);
});

test('phone games explain themselves and say clearly when the laptop server is missing', async t => {
  const app = setup(t);
  app.route('games');
  app.click('[data-filter="phones"]');
  assert.deepEqual(app.all('[data-game]').map(card => card.dataset.game), ['matatu', 'rps', 'four-row']);
  app.openGame('matatu');
  assert.match(app.query('.auto-team-note').textContent, /own phone: 2–6 players/);
  assert.equal(app.query('.name-crew'), null);
  app.window.fetch = () => Promise.reject(new Error('offline'));
  app.click('[data-action="start-round"]');
  assert.ok(app.query('#game-dialog').classList.contains('stage-mode'));
  await settle(); await settle();
  assert.match(app.query('#dialog-title').textContent, /Couldn’t open a table/);
  app.click('[data-phone-action="close"]');
  assert.equal(app.query('#game-dialog').open, false);
});

test('Imposter, Pass the Bomb, Most Likely To and Would You Rather offer phones or one shared screen', async t => {
  const app = setup(t);
  for (const id of ['imposter', 'pass-bomb', 'most-likely', 'would-you-rather']) {
    app.openGame(id);
    assert.ok(app.query('[data-action="start-phones"]'), `${id} can be played on phones`);
    assert.match(app.query('[data-action="start-round"]').textContent, /Pass one screen/);
    assert.match(app.query('.phone-mode-note').textContent, /scans a code/);
    app.click('#close-game');
  }
  app.setValue('#player-count', 2);
  app.openGame('imposter');
  assert.ok(app.query('[data-action="start-phones"]'), 'phones work even when the guest list is short');
  const sent = [];
  app.window.fetch = (url, init) => { sent.push([url, init && JSON.parse(init.body)]); return Promise.reject(new Error('offline')); };
  app.setValue('#game-category', 'food');
  app.click('[data-action="start-phones"]');
  await settle(); await settle();
  assert.deepEqual(sent[0], ['/api/rooms', { game: 'imposter', options: { category: 'food', duration: 180 } }]);
  assert.match(app.query('#dialog-title').textContent, /Couldn’t open a table/);
});
