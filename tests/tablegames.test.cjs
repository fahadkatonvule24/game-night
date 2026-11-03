'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { matatu, cardPoints, rps, fourRow, createRooms, GameError } = require('../tablegames.cjs');

const players = n => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Guest ${i + 1}`, emoji: '🦁' }));
const card = (rank, suit) => ({ id: `${rank}${suit}`, rank, suit });
function seeded(seed = 3) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

// Sets up a Matatu table with chosen hands, a plain top card and a known cutting suit.
function table(count, hands, top = card('5', '♥'), cutSuit = '♣') {
  const state = matatu.create(players(count), seeded(count));
  Object.entries(hands).forEach(([id, cards]) => { state.hands[id] = cards; });
  state.discard = [top];
  state.suit = top.suit;
  state.cutSuit = cutSuit;
  state.cutCard = card('K', cutSuit);
  state.turn = 0;
  return state;
}

test('Matatu deals seven cards each from a full deck and turns up a cutting card at the bottom', () => {
  for (const count of [2, 4, 6]) {
    const state = matatu.create(players(count), seeded(count));
    assert.ok(Object.values(state.hands).every(h => h.length === 7));
    assert.equal(state.deck.at(-1), state.cutCard, 'the cutting card sits face up under the deck');
    assert.equal(state.cutSuit, state.cutCard.suit);
    assert.equal(matatu.power(state.discard[0], state.cutSuit), null, 'the game opens on a plain card');
    const all = [...Object.values(state.hands).flat(), ...state.deck, ...state.discard].map(c => c.id);
    assert.equal(all.length, 52);
    assert.equal(new Set(all).size, 52);
  }
  assert.deepEqual([card('A', '♠'), card('2', '♥'), card('8', '♦'), card('J', '♣'), card('7', '♣'), card('7', '♥'), card('Q', '♠')].map(c => matatu.power(c, '♣')), ['ace', 'two', 'skip', 'skip', 'cut', null, null]);
  assert.deepEqual([card('A', '♠'), card('2', '♥'), card('10', '♦'), card('J', '♣'), card('Q', '♠'), card('K', '♥')].map(cardPoints), [15, 20, 10, 11, 12, 13]);
});

test('players follow suit or rank, Aces go on anything and choose the suit, and picking ends the turn', () => {
  const state = table(3, { p1: [card('9', '♠'), card('5', '♣'), card('A', '♦'), card('K', '♥')], p2: [card('3', '♦'), card('4', '♦')] });
  assert.throws(() => matatu.act(state, 'p2', { type: 'pick' }), /Guest 1’s turn/);
  assert.throws(() => matatu.act(state, 'p1', { type: 'play', cardId: '9♠' }), /doesn’t follow/);
  assert.throws(() => matatu.act(state, 'p1', { type: 'play', cardId: 'A♦' }), /Choose a suit/);
  matatu.act(state, 'p1', { type: 'play', cardId: '5♣' });
  assert.equal(state.suit, '♣', 'matching the rank changes the suit');
  assert.equal(state.turn, 1);
  const before = state.hands.p2.length;
  matatu.act(state, 'p2', { type: 'pick' });
  assert.equal(state.hands.p2.length, before + 1);
  assert.equal(state.turn, 2, 'picking one card ends your turn');
  state.turn = 0;
  matatu.act(state, 'p1', { type: 'play', cardId: 'A♦', suit: '♠' });
  assert.equal(state.suit, '♠');
  const views = ['p1', 'p2'].map(id => matatu.view(state, id));
  assert.equal(views[1].you.yourTurn, true);
  assert.equal(views[0].you.hand.length, 2, 'each phone only sees its own hand');
  assert.equal(matatu.view(state, null).you, null, 'the big screen sees no hands');
  assert.equal(matatu.view(state, null).players[0].hand, undefined, 'hands stay hidden until the game ends');
});

test('a 2 makes the next player pick 2, and answering with a 2 passes on 4', () => {
  const state = table(3, { p1: [card('2', '♥'), card('9', '♠')], p2: [card('2', '♠'), card('9', '♥')], p3: [card('6', '♠'), card('6', '♦')] });
  matatu.act(state, 'p1', { type: 'play', cardId: '2♥' });
  assert.equal(state.pending, 2);
  assert.ok(state.events.some(e => e.type === 'two' && e.targetId === 'p2' && e.count === 2));
  assert.throws(() => matatu.act(state, 'p2', { type: 'play', cardId: '9♥' }), /Answer with a 2, or pick 2/);
  assert.deepEqual(matatu.view(state, 'p2').you.hand.filter(c => c.playable).map(c => c.id), ['2♠'], 'only a 2 can answer a 2');
  matatu.act(state, 'p2', { type: 'play', cardId: '2♠' });
  assert.equal(state.pending, 4);
  const hand = state.hands.p3.length;
  matatu.act(state, 'p3', { type: 'pick' });
  assert.equal(state.hands.p3.length, hand + 4);
  assert.equal(state.pending, 0);
  assert.ok(state.events.some(e => e.type === 'penalty' && e.count === 4));
  assert.equal(state.turn, 0);
});

test('an 8 or a Jack skips the next player, and with two players you go again', () => {
  const three = table(3, { p1: [card('8', '♥'), card('3', '♣')], p2: [card('5', '♠')], p3: [card('J', '♥'), card('4', '♣')] });
  matatu.act(three, 'p1', { type: 'play', cardId: '8♥' });
  assert.equal(three.turn, 2, 'Guest 2 is skipped');
  assert.ok(three.events.some(e => e.type === 'skip' && e.targetId === 'p2'));
  matatu.act(three, 'p3', { type: 'play', cardId: 'J♥' });
  assert.equal(three.turn, 1, 'Guest 1 is skipped');
  const two = table(2, { p1: [card('J', '♥'), card('9', '♥'), card('4', '♣')], p2: [card('5', '♠')] });
  matatu.act(two, 'p1', { type: 'play', cardId: 'J♥' });
  assert.equal(two.turn, 0, 'in a two-player game you play again');
});

test('the cutter ends the game, everyone counts their hand, and the lowest points win', () => {
  const state = table(3, {
    p1: [card('7', '♣'), card('K', '♠'), card('Q', '♠')],
    p2: [card('3', '♦'), card('2', '♦')],
    p3: [card('4', '♥'), card('5', '♠')]
  }, card('9', '♣'), '♣');
  assert.equal(matatu.view(state, 'p1').you.points, 7 + 13 + 12);
  assert.equal(matatu.view(state, 'p1').you.hand[0].power, 'cut');
  matatu.act(state, 'p1', { type: 'play', cardId: '7♣' });
  assert.equal(state.ending, 'cut');
  assert.deepEqual(state.scores, { p1: 25, p2: 23, p3: 9 });
  assert.deepEqual(state.winnerIds, ['p3'], 'the cutter does not automatically win');
  const shown = matatu.view(state, null);
  assert.equal(shown.cutterId, 'p1');
  assert.deepEqual(shown.players[2].hand.map(c => c.id), ['4♥', '5♠'], 'hands are shown at the end');
  assert.throws(() => matatu.act(state, 'p2', { type: 'pick' }), /game is over/);
  matatu.act(state, 'p2', { type: 'rematch' });
  assert.equal(state.winnerIds, null);
  assert.equal(state.turn, 2, 'a winner starts the rematch');
});

test('emptying your hand wins, warns on the last card, and the picking deck reshuffles all but the top card', () => {
  const state = table(2, { p1: [card('6', '♥'), card('7', '♥')], p2: [card('9', '♠')] });
  matatu.act(state, 'p1', { type: 'play', cardId: '6♥' });
  assert.ok(state.events.some(e => e.type === 'last-card' && e.playerId === 'p1'));
  state.turn = 0;
  matatu.act(state, 'p1', { type: 'play', cardId: '7♥' });
  assert.equal(state.ending, 'empty');
  assert.deepEqual(state.winnerIds, ['p1']);

  const dry = table(2, { p1: [card('9', '♠')], p2: [card('9', '♦')] });
  dry.deck = [];
  dry.discard = [card('2', '♥'), card('3', '♥'), card('4', '♥'), card('6', '♥'), card('7', '♥')];
  dry.suit = '♥';
  matatu.act(dry, 'p1', { type: 'pick' });
  assert.deepEqual(dry.discard.map(c => c.id), ['7♥'], 'the top card stays');
  assert.equal(dry.deck.length + dry.hands.p1.length, 5, 'the other four went back into the deck');
  assert.ok(dry.events.some(e => e.type === 'reshuffle' && e.count === 4));
  dry.deck = [];
  dry.discard = [card('9', '♣')];
  matatu.act(dry, 'p2', { type: 'pick' });
  assert.ok(dry.events.some(e => e.type === 'pass'), 'with no cards anywhere, picking just passes');
});

test('Rock Paper Scissors keeps throws secret until both are in, and first to three wins', () => {
  const state = rps.create(players(2));
  rps.act(state, 'p1', { type: 'throw', choice: 'rock' });
  assert.equal(rps.view(state, 'p2').players[0].thrown, true);
  assert.equal(JSON.stringify(rps.view(state, 'p2')).includes('rock'), false, 'the rival cannot see your throw');
  assert.throws(() => rps.act(state, 'p1', { type: 'throw', choice: 'paper' }), /already thrown/);
  rps.act(state, 'p2', { type: 'throw', choice: 'scissors' });
  assert.equal(state.scores.p1, 1);
  rps.act(state, 'p1', { type: 'throw', choice: 'paper' });
  rps.act(state, 'p2', { type: 'throw', choice: 'paper' });
  assert.equal(state.rounds[1].winnerId, null);
  for (let i = 0; i < 2; i += 1) { rps.act(state, 'p1', { type: 'throw', choice: 'scissors' }); rps.act(state, 'p2', { type: 'throw', choice: 'paper' }); }
  assert.equal(state.winnerId, 'p1');
  assert.throws(() => rps.act(state, 'p2', { type: 'throw', choice: 'rock' }), /over/);
  rps.act(state, 'p2', { type: 'rematch' });
  assert.deepEqual(state.scores, { p1: 0, p2: 0 });
});

test('Four in a Row stacks discs, takes turns, and spots wins across, down and diagonally', () => {
  const state = fourRow.create(players(2));
  assert.throws(() => fourRow.act(state, 'p2', { type: 'drop', column: 0 }), /Guest 1’s turn/);
  for (const column of [0, 1, 0, 1, 0, 1]) fourRow.act(state, state.players[state.turn].id, { type: 'drop', column });
  assert.equal(state.board[5][0], 0);
  assert.equal(state.board[4][0], 0);
  fourRow.act(state, 'p1', { type: 'drop', column: 0 });
  assert.equal(state.winnerId, 'p1');
  assert.equal(state.line.length, 4);
  fourRow.act(state, 'p1', { type: 'rematch' });
  assert.equal(state.turn, 1, 'the other player starts the rematch');
  const diagonal = fourRow.create(players(2));
  diagonal.board[5] = [0, 1, 1, 1, null, null, null];
  diagonal.board[4] = [null, 0, 1, 0, null, null, null];
  diagonal.board[3] = [null, null, 0, 1, null, null, null];
  assert.ok(fourRow.findLine([...diagonal.board.slice(0, 2), [null, null, null, 0, null, null, null], ...diagonal.board.slice(3)], 2, 3));
  const full = fourRow.create(players(2));
  full.board[0] = [0, 0, 0, null, 0, 0, 0];
  assert.throws(() => fourRow.act(full, 'p1', { type: 'drop', column: 9 }), /Choose a column/);
});

test('rooms keep each phone’s key private, cap seats, and only the big screen can start', () => {
  const rooms = createRooms({ rng: seeded() });
  const { code, hostKey } = rooms.create('rps');
  assert.match(code, /^[A-HJ-NP-Z]{4}$/);
  const a = rooms.join(code, { name: '  Amina  ', emoji: '🦊' });
  const b = rooms.join(code, { name: 'amina' });
  assert.throws(() => rooms.join(code, { name: 'Third' }), /full/);
  assert.throws(() => rooms.join('ZZZZ', { name: 'Lost' }), /doesn’t exist/);
  assert.deepEqual(rooms.join(code, { playerId: a.playerId, key: a.key }), a, 'a phone can rejoin with its key');
  const views = [];
  rooms.subscribe(code, { playerId: b.playerId, key: b.key }, { send: v => views.push(v), end() {} });
  assert.deepEqual(views[0].players.map(p => p.name), ['Amina', 'amina 2']);
  assert.throws(() => rooms.subscribe(code, { playerId: b.playerId, key: 'wrong' }, { send() {}, end() {} }), /not seated/);
  assert.throws(() => rooms.start(code, 'not-the-host'), /big screen/);
  rooms.start(code, hostKey);
  assert.equal(views[views.length - 1].started, true);
  assert.throws(() => rooms.act(code, { playerId: a.playerId, key: b.key, action: { type: 'throw', choice: 'rock' } }), /not seated/);
  rooms.act(code, { playerId: a.playerId, key: a.key, action: { type: 'throw', choice: 'rock' } });
  assert.throws(() => rooms.act(code, { playerId: a.playerId, key: a.key, action: { type: 'throw', choice: 'rock' } }), GameError);
  assert.throws(() => rooms.join(code, { name: 'Late' }), /already started|full/);
  rooms.close(code, hostKey);
  assert.equal(rooms.size, 0);
});

const { imposter, passBomb, mostLikely, wouldYouRather } = require('../tablegames.cjs');

test('Imposter on phones: each phone sees only its own role, the big screen sees no secrets until the reveal', () => {
  const state = imposter.create(players(4), seeded(5), imposter.setup({ category: 'animals', duration: 60 }), 0);
  const host = imposter.view(state, null);
  assert.equal(host.word, null);
  assert.equal(host.imposterId, null);
  assert.equal(JSON.stringify(host).includes(state.word), false, 'the laptop never shows the word early');
  for (const p of state.players) {
    const you = imposter.view(state, p.id).you;
    if (p.id === state.imposterId) { assert.equal(you.imposter, true); assert.equal(you.word, null); }
    else { assert.equal(you.imposter, false); assert.equal(you.word, state.word); }
  }
  assert.equal(host.label, 'Animals');
  imposter.act(state, 'p1', { type: 'seen' });
  assert.equal(imposter.view(state, null).players[0].seen, true);
  assert.throws(() => imposter.act(state, 'p1', { type: 'vote', targetId: 'p2' }), /hasn’t opened/);
  assert.throws(() => imposter.act(state, 'p1', { type: 'reveal' }), /Unknown move/, 'phones cannot reveal');
  imposter.act(state, null, { type: 'discuss' }, { host: true, now: 1000 });
  assert.equal(state.endsAt, 61000);
  assert.equal(state.wakeAt, 61000);
  imposter.tick(state, 61000);
  assert.equal(state.phase, 'voting', 'the clue clock opens voting by itself');
  assert.throws(() => imposter.act(state, 'p1', { type: 'vote', targetId: 'p1' }), /yourself/);
  for (const p of state.players) imposter.act(state, p.id, { type: 'vote', targetId: p.id === state.imposterId ? state.players.find(o => o.id !== p.id).id : state.imposterId });
  assert.equal(imposter.view(state, null).votes, 4);
  assert.equal(imposter.view(state, null).counts, null, 'votes stay hidden until the reveal');
  imposter.act(state, null, { type: 'reveal' }, { host: true });
  assert.equal(state.phase, 'last-guess');
  const outsider = state.players.find(p => p.id !== state.imposterId).id;
  assert.throws(() => imposter.act(state, outsider, { type: 'guess', text: 'x' }), /Only the caught imposter/);
  imposter.act(state, state.imposterId, { type: 'guess', text: ` ${state.word.toUpperCase()}! ` });
  const result = imposter.view(state, null);
  assert.equal(result.winner, 'imposter');
  assert.equal(result.word, state.word);
  const word = state.word;
  imposter.act(state, null, { type: 'next' }, { host: true, now: 5 });
  assert.equal(state.round, 2);
  assert.equal(state.phase, 'roles');
  assert.notEqual(state.word, word, 'a new round brings a new word');
});

test('Imposter reveal handles a wrong accusation, a tie, and house words', () => {
  const state = imposter.create(players(3), seeded(9), imposter.setup({ category: 'house', words: ['Uncle Joe', '  '] }), 0);
  assert.equal(state.word, 'Uncle Joe');
  imposter.act(state, null, { type: 'vote' }, { host: true });
  const innocent = state.players.find(p => p.id !== state.imposterId).id;
  for (const p of state.players) if (p.id !== innocent) imposter.act(state, p.id, { type: 'vote', targetId: innocent });
  imposter.act(state, null, { type: 'reveal' }, { host: true });
  assert.equal(state.outcome, 'innocent-accused');
  assert.equal(state.winner, 'imposter');
  assert.throws(() => imposter.setup({ category: 'house', words: [] }), /house words/);
  const tie = imposter.create(players(4), seeded(2), imposter.setup(), 0);
  imposter.act(tie, null, { type: 'vote' }, { host: true });
  imposter.act(tie, 'p1', { type: 'vote', targetId: 'p2' });
  imposter.act(tie, 'p2', { type: 'vote', targetId: 'p1' });
  imposter.act(tie, null, { type: 'reveal' }, { host: true });
  assert.equal(tie.outcome, 'tie');
});

test('Pass the Bomb: only the holder passes, each hold brings a new question, and the hidden fuse explodes on its own', () => {
  const state = passBomb.create(players(4), seeded(4));
  const first = state.holderId;
  const other = state.players.find(p => p.id !== first).id;
  assert.equal(passBomb.view(state, first).you.holding, true);
  assert.equal(passBomb.view(state, other).you.holding, false);
  assert.throws(() => passBomb.act(state, other, { type: 'light' }, { now: 0 }), /holding the bomb/);
  passBomb.act(state, first, { type: 'light' }, { now: 0 });
  assert.ok(state.fuse >= 20000 && state.fuse < 45000);
  assert.equal(state.tempo, 1);
  assert.equal(state.wakeAt, state.fuse * 0.5);
  const notHolder = state.players.find(p => p.id !== state.holderId).id;
  assert.throws(() => passBomb.act(state, notHolder, { type: 'pass' }, { now: 10 }), /have the bomb/);
  const questions = new Set([state.prompt]);
  for (let i = 0; i < 8; i += 1) {
    const holder = state.holderId;
    const before = state.previousId;
    passBomb.act(state, holder, { type: 'pass' }, { now: 10 });
    assert.notEqual(state.holderId, holder, 'the bomb always moves on');
    assert.notEqual(state.holderId, before, 'never straight back to the last passer');
    questions.add(state.prompt);
  }
  assert.equal(questions.size, 9, 'every hold gets a different question');
  passBomb.tick(state, state.fuse * 0.6);
  assert.equal(state.tempo, 2);
  passBomb.tick(state, state.fuse * 0.9);
  assert.equal(state.tempo, 3);
  const unlucky = state.holderId;
  passBomb.tick(state, state.fuse);
  assert.equal(state.phase, 'boom');
  assert.equal(passBomb.view(state, null).players.find(p => p.id === unlucky).blasts, 1);
  assert.throws(() => passBomb.act(state, unlucky, { type: 'next' }, {}), /big screen/);
  passBomb.act(state, null, { type: 'next' }, { host: true });
  assert.equal(state.phase, 'ready');
  assert.equal(state.holderId, unlucky, 'whoever blew up starts the next round');
  for (let round = 2; round <= 5; round += 1) {
    passBomb.act(state, null, { type: 'light' }, { host: true, now: 0 });
    passBomb.tick(state, 10 ** 6);
    passBomb.act(state, null, { type: 'next' }, { host: true });
  }
  assert.equal(state.phase, 'over');
});

test('Most Likely To and Would You Rather keep votes secret until the big screen reveals them', () => {
  const likely = mostLikely.create(players(3), seeded(6));
  mostLikely.act(likely, 'p1', { type: 'vote', targetId: 'p2' });
  mostLikely.act(likely, 'p2', { type: 'vote', targetId: 'p2' });
  mostLikely.act(likely, 'p1', { type: 'vote', targetId: 'p3' });
  assert.equal(mostLikely.view(likely, null).result, null);
  assert.equal(mostLikely.view(likely, 'p1').you.vote, 'p3', 'votes can change until the reveal');
  assert.throws(() => mostLikely.act(likely, 'p1', { type: 'reveal' }), /Unknown move/);
  mostLikely.act(likely, null, { type: 'reveal' }, { host: true });
  assert.deepEqual(mostLikely.view(likely, null).result.votes, { p1: 'p3', p2: 'p2' });
  assert.throws(() => mostLikely.act(likely, 'p3', { type: 'vote', targetId: 'p1' }), /locked/);
  for (let i = 0; i < 9; i += 1) { mostLikely.act(likely, null, { type: 'next' }, { host: true }); mostLikely.act(likely, 'p1', { type: 'vote', targetId: 'p1' }); mostLikely.act(likely, null, { type: 'reveal' }, { host: true }); }
  mostLikely.act(likely, null, { type: 'next' }, { host: true });
  const titles = mostLikely.view(likely, null).summary.titles;
  assert.equal(titles.p1.length, 9);
  assert.equal(titles.p2.length, 1, 'tied leaders share the title');

  const rather = wouldYouRather.create(players(3), seeded(7));
  assert.ok(rather.prompt.a && rather.prompt.b);
  assert.throws(() => wouldYouRather.act(rather, 'p1', { type: 'vote', side: 'c' }), /A or B/);
  wouldYouRather.act(rather, 'p1', { type: 'vote', side: 'a' });
  wouldYouRather.act(rather, 'p2', { type: 'vote', side: 'a' });
  wouldYouRather.act(rather, 'p3', { type: 'vote', side: 'b' });
  wouldYouRather.act(rather, null, { type: 'reveal' }, { host: true });
  for (let i = 0; i < 9; i += 1) { wouldYouRather.act(rather, null, { type: 'next' }, { host: true }); wouldYouRather.act(rather, 'p1', { type: 'vote', side: 'b' }); wouldYouRather.act(rather, null, { type: 'reveal' }, { host: true }); }
  wouldYouRather.act(rather, null, { type: 'next' }, { host: true });
  assert.deepEqual(wouldYouRather.view(rather, null).summary.rebels, { p3: 1 });
});

test('rooms run game timers on the server and only let the big screen use host buttons', () => {
  let clock = 0;
  const timers = [];
  const rooms = createRooms({ rng: seeded(8), now: () => clock, setTimer: (fn, ms) => { const t = { fn, at: clock + ms }; timers.push(t); return t; }, clearTimer: t => { const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); } });
  const { code, hostKey } = rooms.create('pass-bomb');
  const seats = ['Amina', 'Brian', 'Chloe'].map(name => rooms.join(code, { name }));
  const views = [];
  rooms.subscribe(code, { hostKey }, { send: v => views.push(v), end() {} });
  rooms.start(code, hostKey);
  assert.throws(() => rooms.act(code, { hostKey, action: { type: 'pass' } }), /Only players/);
  assert.throws(() => rooms.act(code, { playerId: seats[0].playerId, key: seats[0].key, action: { type: 'next' } }), /big screen/);
  rooms.act(code, { hostKey, action: { type: 'light' } });
  assert.equal(timers.length, 1);
  while (timers.length) { const t = timers.shift(); clock = t.at; t.fn(); }
  assert.equal(views.at(-1).game.phase, 'boom', 'the fuse went off with nobody touching anything');
  rooms.close(code, hostKey);

  const table = rooms.create('imposter', { category: 'food', duration: 120 });
  ['A', 'B', 'C'].forEach(name => rooms.join(table.code, { name }));
  rooms.start(table.code, table.hostKey);
  rooms.act(table.code, { hostKey: table.hostKey, action: { type: 'discuss' } });
  assert.equal(timers.at(-1).at, clock + 120000);
  rooms.close(table.code, table.hostKey);
  assert.equal(timers.length, 0, 'closing a table clears its timers');
});
