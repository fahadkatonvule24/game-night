'use strict';

// Phone games played over the local network. Each game is pure rules: create a state,
// show each person only what they may see, and apply one action at a time.
const crypto = require('node:crypto');

const FACES = ['🦁', '🐯', '🦊', '🐼', '🐸', '🐵', '🐨', '🦄', '🐙', '🦉', '🐧', '🐢', '🦒', '🐘', '🦓', '🦩', '🐬', '🦋', '🐝', '🐞'];
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

class GameError extends Error {}
const fail = message => { throw new GameError(message); };

function shuffle(items, rng) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
const publicPlayer = p => ({ id: p.id, name: p.name, emoji: p.emoji });

// ---------------------------------------------------------------------------
// Matatu, the Ugandan card game. Follow the suit or rank of the top card, or pick one.
//   2      → the next player picks 2, unless they answer with a 2 (then the next picks 4, and so on)
//   8 / J  → skip the next player
//   A      → play on anything and choose the suit
//   Cutter → the 7 of the cutting card's suit ends the game; lowest hand points wins
// You also win by playing every card in your hand.
const POINTS = { A: 15, 2: 20, J: 11, Q: 12, K: 13 };
const cardPoints = card => POINTS[card.rank] ?? Number(card.rank);
const handPoints = hand => hand.reduce((sum, card) => sum + cardPoints(card), 0);
const matatu = {
  title: 'Matatu', min: 2, max: 6, handSize: 7,
  power(card, cutSuit) {
    if (card.rank === '7' && card.suit === cutSuit) return 'cut';
    return { 2: 'two', 8: 'skip', J: 'skip', A: 'ace' }[card.rank] || null;
  },
  create(players, rng) {
    const deck = shuffle(SUITS.flatMap(suit => RANKS.map(rank => ({ id: `${rank}${suit}`, rank, suit }))), rng);
    const hands = Object.fromEntries(players.map(p => [p.id, deck.splice(0, matatu.handSize)]));
    // The cutting card is turned face up at the bottom of the deck. Its suit names the cutter.
    const cutCard = deck.shift();
    // The game opens on a plain card: no power cards and no cutter.
    const openAt = deck.findIndex(card => !matatu.power(card, cutCard.suit));
    const first = deck.splice(Math.max(0, openAt), 1)[0];
    deck.push(cutCard);
    return {
      players: players.map(publicPlayer), hands, deck, discard: [first], suit: first.suit, cutCard, cutSuit: cutCard.suit,
      turn: 0, pending: 0, winnerIds: null, ending: null, scores: null, seq: 0, events: [{ seq: 0, type: 'start', card: first }], rng
    };
  },
  isCutter: (state, card) => card.rank === '7' && card.suit === state.cutSuit,
  playable(state, card) {
    if (state.pending) return card.rank === '2';
    if (card.rank === 'A') return true;
    const top = state.discard[state.discard.length - 1];
    return card.suit === state.suit || card.rank === top.rank;
  },
  act(state, playerId, action) {
    if (action.type === 'rematch') return matatu.rematch(state);
    if (state.winnerIds) fail('This game is over. Start a rematch!');
    const player = state.players[state.turn];
    if (player.id !== playerId) fail(`It’s ${player.name}’s turn.`);
    const hand = state.hands[playerId];
    const log = event => { state.seq += 1; state.events.push({ seq: state.seq, playerId, ...event }); state.events = state.events.slice(-12); };
    if (action.type === 'play') {
      const index = hand.findIndex(card => card.id === action.cardId);
      if (index < 0) fail('That card isn’t in your hand.');
      const card = hand[index];
      if (!matatu.playable(state, card)) {
        const top = state.discard[state.discard.length - 1];
        fail(state.pending ? `Answer with a 2, or pick ${state.pending}.` : `That doesn’t follow. Play a ${state.suit}, a ${top.rank}, or an Ace.`);
      }
      if (card.rank === 'A' && !SUITS.includes(action.suit)) fail('Choose a suit for your Ace.');
      hand.splice(index, 1);
      state.discard.push(card);
      state.suit = card.rank === 'A' ? action.suit : card.suit;
      const power = matatu.power(card, state.cutSuit);
      log({ type: 'play', card, suit: state.suit, power, left: hand.length });
      if (power === 'cut') { matatu.finish(state, 'cut', playerId); log({ type: 'cut', card }); return; }
      if (!hand.length) { matatu.finish(state, 'empty', playerId); log({ type: 'win' }); return; }
      if (hand.length === 1) log({ type: 'last-card' });
      if (power === 'two') {
        state.pending += 2;
        matatu.advance(state, 1);
        log({ type: 'two', count: state.pending, targetId: state.players[state.turn].id });
      } else if (power === 'skip') {
        const skipped = state.players[(state.turn + 1) % state.players.length];
        matatu.advance(state, 2);
        log({ type: 'skip', targetId: skipped.id });
      } else matatu.advance(state, 1);
    } else if (action.type === 'pick') {
      // Picking ends your turn. A pile of 2s means picking the whole lot.
      const count = state.pending || 1;
      let drawn = 0;
      for (let i = 0; i < count; i += 1) {
        if (!state.deck.length) matatu.reshuffle(state, log);
        if (!state.deck.length) break;
        hand.push(state.deck.shift());
        drawn += 1;
      }
      log(state.pending ? { type: 'penalty', count: drawn } : drawn ? { type: 'pick' } : { type: 'pass' });
      state.pending = 0;
      matatu.advance(state, 1);
    } else fail('Unknown move.');
  },
  // When the picking deck runs out, the top played card stays and the rest are shuffled back in.
  reshuffle(state, log) {
    if (state.discard.length < 2) return;
    const top = state.discard.pop();
    state.deck = shuffle(state.discard, state.rng);
    state.discard = [top];
    log({ type: 'reshuffle', count: state.deck.length });
  },
  advance(state, steps) { state.turn = (state.turn + steps) % state.players.length; },
  // The game ends when someone empties their hand or plays the cutter. Everyone's hand is scored either way.
  finish(state, ending, playerId) {
    state.scores = Object.fromEntries(state.players.map(p => [p.id, handPoints(state.hands[p.id])]));
    const low = Math.min(...Object.values(state.scores));
    state.winnerIds = ending === 'empty' ? [playerId] : state.players.filter(p => state.scores[p.id] === low).map(p => p.id);
    state.ending = ending;
    state.cutterId = ending === 'cut' ? playerId : null;
  },
  rematch(state) {
    if (!state.winnerIds) fail('Finish this game first.');
    const fresh = matatu.create(state.players, state.rng);
    // A winner starts the next one.
    fresh.turn = state.players.findIndex(p => p.id === state.winnerIds[0]);
    Object.assign(state, fresh, { cutterId: null });
  },
  view(state, playerId) {
    const top = state.discard[state.discard.length - 1];
    const current = state.players[state.turn];
    const mine = playerId && state.hands[playerId];
    const over = Boolean(state.winnerIds);
    const yourTurn = Boolean(mine) && current.id === playerId && !over;
    return {
      top, suit: state.suit, cutCard: state.cutCard, cutSuit: state.cutSuit, pending: state.pending,
      deckCount: state.deck.length, discardCount: state.discard.length, turnId: current.id, events: state.events,
      winnerIds: state.winnerIds, ending: state.ending, cutterId: state.cutterId || null, scores: state.scores,
      players: state.players.map(p => ({ ...p, cards: state.hands[p.id].length, hand: over ? state.hands[p.id] : undefined })),
      you: mine ? {
        hand: mine.map(card => ({ ...card, power: matatu.power(card, state.cutSuit), playable: yourTurn && matatu.playable(state, card) })),
        points: handPoints(mine), yourTurn
      } : null
    };
  }
};

// ---------------------------------------------------------------------------
// Rock Paper Scissors: both throw in secret, first to three wins.
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
const rps = {
  title: 'Rock Paper Scissors', min: 2, max: 2, target: 3,
  create(players) {
    return { players: players.map(publicPlayer), scores: Object.fromEntries(players.map(p => [p.id, 0])), picks: {}, rounds: [], winnerId: null, seq: 0 };
  },
  act(state, playerId, action) {
    if (action.type === 'rematch') {
      if (!state.winnerId) fail('Finish this duel first.');
      Object.assign(state, rps.create(state.players), { seq: state.seq + 1 });
      return;
    }
    if (state.winnerId) fail('This duel is over. Start a rematch!');
    if (action.type !== 'throw' || !BEATS[action.choice]) fail('Choose rock, paper, or scissors.');
    if (state.picks[playerId]) fail('You’ve already thrown. Waiting on your rival…');
    state.picks[playerId] = action.choice;
    state.seq += 1;
    if (Object.keys(state.picks).length < 2) return;
    const [a, b] = state.players;
    const pa = state.picks[a.id];
    const pb = state.picks[b.id];
    const winnerId = pa === pb ? null : BEATS[pa] === pb ? a.id : b.id;
    if (winnerId) state.scores[winnerId] += 1;
    state.rounds.push({ picks: { ...state.picks }, winnerId });
    state.picks = {};
    if (winnerId && state.scores[winnerId] >= rps.target) state.winnerId = winnerId;
  },
  view(state, playerId) {
    return {
      players: state.players.map(p => ({ ...p, score: state.scores[p.id], thrown: Boolean(state.picks[p.id]) })),
      target: rps.target, round: state.rounds.length + 1, last: state.rounds[state.rounds.length - 1] || null,
      winnerId: state.winnerId, seq: state.seq,
      you: playerId && playerId in state.scores ? { choice: state.picks[playerId] || null } : null
    };
  }
};

// ---------------------------------------------------------------------------
// Four in a Row: drop discs into a 7 × 6 grid. Four in a line wins.
const COLS = 7;
const ROWS = 6;
const fourRow = {
  title: 'Four in a Row', min: 2, max: 2,
  create(players, rng, starter = 0) {
    return { players: players.map(publicPlayer), board: Array.from({ length: ROWS }, () => new Array(COLS).fill(null)), turn: starter, winnerId: null, line: [], draw: false, last: null, seq: 0, starter };
  },
  act(state, playerId, action) {
    if (action.type === 'rematch') {
      if (!state.winnerId && !state.draw) fail('Finish this game first.');
      Object.assign(state, fourRow.create(state.players, null, 1 - state.starter), { seq: state.seq + 1 });
      return;
    }
    if (state.winnerId || state.draw) fail('This game is over. Start a rematch!');
    const player = state.players[state.turn];
    if (player.id !== playerId) fail(`It’s ${player.name}’s turn.`);
    const column = Number(action.column);
    if (action.type !== 'drop' || !Number.isInteger(column) || column < 0 || column >= COLS) fail('Choose a column.');
    let row = ROWS - 1;
    while (row >= 0 && state.board[row][column] !== null) row -= 1;
    if (row < 0) fail('That column is full.');
    state.board[row][column] = state.turn;
    state.last = { row, column };
    state.seq += 1;
    const line = fourRow.findLine(state.board, row, column);
    if (line) { state.winnerId = playerId; state.line = line; return; }
    if (state.board[0].every(cell => cell !== null)) { state.draw = true; return; }
    state.turn = 1 - state.turn;
  },
  findLine(board, row, column) {
    const who = board[row][column];
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const line = [[row, column]];
      for (const sign of [1, -1]) {
        let r = row + dr * sign;
        let c = column + dc * sign;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === who) { line.push([r, c]); r += dr * sign; c += dc * sign; }
      }
      if (line.length >= 4) return line;
    }
    return null;
  },
  view(state, playerId) {
    const seat = state.players.findIndex(p => p.id === playerId);
    return {
      players: state.players, board: state.board, turnId: state.players[state.turn].id, winnerId: state.winnerId,
      draw: state.draw, line: state.line, last: state.last, seq: state.seq,
      you: seat >= 0 ? { seat, yourTurn: !state.winnerId && !state.draw && state.turn === seat } : null
    };
  }
};

// ---------------------------------------------------------------------------
// Party games played on phones. The big screen (host) runs the show with host-only actions;
// each phone sees its own secret and casts its own vote.
const randomItem = (list, rng) => list[Math.floor(rng() * list.length)];
// A deck that never repeats until every card has been dealt.
function dealer(items, rng) {
  let deck = [];
  return () => {
    if (!deck.length) deck = shuffle(items, rng);
    return deck.pop();
  };
}
function tally(votes) {
  const counts = {};
  Object.values(votes).forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const top = Math.max(0, ...Object.values(counts));
  return { counts, leaders: Object.keys(counts).filter(id => counts[id] === top) };
}
const seated = (state, id) => state.players.some(p => p.id === id);

// Guess the Imposter: every phone shows its own role; votes are cast on phones and
// the big screen reveals the imposter when the host is ready.
const DISCUSSION = [60, 120, 180, 300];
const imposter = {
  title: 'Guess the Imposter', min: 3, max: 12, hostActions: ['discuss', 'vote', 'reveal', 'next'],
  setup(options = {}) {
    const core = require('./core.js');
    const category = String(options.category || 'all');
    let words;
    if (category === 'house') {
      words = (Array.isArray(options.words) ? options.words : []).filter(w => typeof w === 'string' && w.trim()).slice(0, 100).map(w => ({ text: w.trim().slice(0, 40), label: 'House words' }));
      if (words.length < 1) fail('Add some house words first.');
    } else {
      const all = core.getGame('imposter').prompts;
      const pool = category === 'all' ? all : all.filter(p => p.category === category);
      words = (pool.length ? pool : all).map(p => ({ text: p.text, label: core.categoryLabel(p.category) }));
    }
    const duration = DISCUSSION.includes(Number(options.duration)) ? Number(options.duration) : 180;
    return { words, duration };
  },
  create(players, rng, setup = imposter.setup(), now = Date.now(), previousWord = null) {
    const fresh = setup.words.filter(w => w.text !== previousWord);
    const secret = randomItem(fresh.length ? fresh : setup.words, rng);
    return {
      players: players.map(publicPlayer), setup, rng, word: secret.text, label: secret.label,
      imposterId: randomItem(players, rng).id, firstSpeakerId: randomItem(players, rng).id,
      round: 1, phase: 'roles', seen: {}, votes: {}, endsAt: null, wakeAt: null, outcome: null, accusedId: null, counts: {}, guess: null, winner: null, seq: 0
    };
  },
  act(state, playerId, action, ctx = {}) {
    const now = ctx.now ?? Date.now();
    const type = action.type;
    state.seq += 1;
    if (ctx.host) {
      if (type === 'discuss' && ['roles', 'discussion'].includes(state.phase)) {
        state.phase = 'discussion';
        state.endsAt = now + state.setup.duration * 1000;
        state.wakeAt = state.endsAt;
      } else if (type === 'vote' && ['roles', 'discussion'].includes(state.phase)) {
        state.phase = 'voting'; state.endsAt = null; state.wakeAt = null;
      } else if (type === 'reveal' && state.phase === 'voting') {
        if (!Object.keys(state.votes).length) fail('Nobody has voted yet.');
        const { counts, leaders } = tally(state.votes);
        state.counts = counts;
        state.accusedId = leaders.length === 1 ? leaders[0] : null;
        if (!state.accusedId) { state.outcome = 'tie'; state.winner = 'imposter'; state.phase = 'result'; }
        else if (state.accusedId !== state.imposterId) { state.outcome = 'innocent-accused'; state.winner = 'imposter'; state.phase = 'result'; }
        else { state.outcome = 'imposter-caught'; state.phase = 'last-guess'; }
      } else if (type === 'reveal' && state.phase === 'last-guess') {
        state.winner = 'group'; state.phase = 'result';
      } else if ((type === 'next' || type === 'rematch') && state.phase === 'result') {
        Object.assign(state, imposter.create(state.players, state.rng, state.setup, now, state.word), { seq: state.seq + 1, round: state.round + 1 });
      } else fail('That isn’t possible right now.');
      return;
    }
    if (!seated(state, playerId)) fail('You’re not seated at this table.');
    if (type === 'seen') { state.seen[playerId] = true; return; }
    if (type === 'vote') {
      if (state.phase !== 'voting') fail('Voting hasn’t opened yet. Watch the big screen!');
      if (action.targetId === playerId) fail('You can’t vote for yourself.');
      if (!seated(state, action.targetId)) fail('Pick someone at the table.');
      state.votes[playerId] = action.targetId;
      return;
    }
    if (type === 'guess' || type === 'give-up') {
      if (state.phase !== 'last-guess' || playerId !== state.imposterId) fail('Only the caught imposter can guess now.');
      const { normalizeGuess } = require('./imposter.js');
      const guess = type === 'guess' ? String(action.text || '').slice(0, 100) : '';
      if (type === 'guess' && !normalizeGuess(guess)) fail('Type a word, or tap “I don’t know”.');
      state.guess = guess;
      state.winner = guess && normalizeGuess(guess) === normalizeGuess(state.word) ? 'imposter' : 'group';
      state.phase = 'result';
      return;
    }
    fail('Unknown move.');
  },
  tick(state, now) {
    if (state.phase === 'discussion' && now >= state.endsAt) { state.phase = 'voting'; state.endsAt = null; }
    state.wakeAt = null;
  },
  view(state, viewerId) {
    const open = ['last-guess', 'result'].includes(state.phase);
    const done = state.phase === 'result';
    const me = viewerId && seated(state, viewerId);
    return {
      phase: state.phase, round: state.round, label: state.label, firstSpeakerId: state.firstSpeakerId, endsAt: state.endsAt, duration: state.setup.duration, seq: state.seq,
      players: state.players.map(p => ({ ...p, seen: Boolean(state.seen[p.id]), voted: Boolean(state.votes[p.id]) })),
      votes: Object.keys(state.votes).length,
      accusedId: open ? state.accusedId : null, imposterId: open ? state.imposterId : null, counts: open ? state.counts : null, outcome: open ? state.outcome : null,
      word: done ? state.word : null, winner: done ? state.winner : null, guess: done ? state.guess : null,
      you: me ? { imposter: viewerId === state.imposterId, word: viewerId === state.imposterId ? null : state.word, votedFor: state.votes[viewerId] || null } : null
    };
  }
};

// Pass the Bomb: the bomb hops from phone to phone. Whoever holds it sees it glow green with
// a brand-new question, answers aloud, and passes. The fuse is hidden and only the server knows it.
const passBomb = {
  title: 'Pass the Bomb', min: 3, max: 12, rounds: 5, hostActions: ['light', 'next'],
  setup() {
    return { prompts: require('./core.js').getGame('pass-bomb').prompts.map(p => p.text) };
  },
  create(players, rng, setup = passBomb.setup()) {
    const draw = dealer(setup.prompts, rng);
    return { players: players.map(publicPlayer), setup, rng, draw, round: 1, phase: 'ready', holderId: randomItem(players, rng).id, previousId: null, prompt: draw(), fuse: 0, startedAt: 0, endsAt: 0, wakeAt: null, tempo: 0, passes: 0, blasts: {}, lastBlastId: null, seq: 0 };
  },
  act(state, playerId, action, ctx = {}) {
    const now = ctx.now ?? Date.now();
    state.seq += 1;
    if (action.type === 'rematch') {
      if (!ctx.host && state.phase !== 'over') fail('Finish this game first.');
      Object.assign(state, passBomb.create(state.players, state.rng, state.setup), { seq: state.seq + 1 });
      return;
    }
    if (action.type === 'light') {
      if (state.phase !== 'ready') fail('The fuse is already lit!');
      if (!ctx.host && playerId !== state.holderId) fail('Only the player holding the bomb can light it.');
      state.phase = 'ticking';
      state.fuse = 20000 + Math.floor(state.rng() * 25000);
      state.startedAt = now;
      state.endsAt = now + state.fuse;
      passBomb.tick(state, now);
      return;
    }
    if (action.type === 'pass') {
      if (state.phase !== 'ticking') fail('Light the fuse first.');
      if (playerId !== state.holderId) fail('You don’t have the bomb!');
      // Never straight back to whoever just passed it, so it really travels.
      const options = state.players.filter(p => p.id !== playerId && (state.players.length < 3 || p.id !== state.previousId));
      state.previousId = playerId;
      state.holderId = randomItem(options, state.rng).id;
      state.prompt = state.draw();
      state.passes += 1;
      return;
    }
    if (action.type === 'next') {
      if (!ctx.host) fail('The big screen starts the next round.');
      if (state.phase !== 'boom') fail('Wait for the boom!');
      if (state.round >= passBomb.rounds) { state.phase = 'over'; return; }
      state.round += 1;
      state.phase = 'ready';
      state.holderId = state.lastBlastId;
      state.previousId = null;
      state.prompt = state.draw();
      state.passes = 0;
      state.tempo = 0;
      return;
    }
    fail('Unknown move.');
  },
  // Ticks get faster in three steps; the boom happens exactly when the hidden fuse ends.
  tick(state, now) {
    if (state.phase !== 'ticking') { state.wakeAt = null; return; }
    if (now >= state.endsAt) {
      state.phase = 'boom';
      state.blasts[state.holderId] = (state.blasts[state.holderId] || 0) + 1;
      state.lastBlastId = state.holderId;
      state.tempo = 0;
      state.wakeAt = null;
      state.seq += 1;
      return;
    }
    const steps = [state.startedAt + state.fuse * 0.5, state.startedAt + state.fuse * 0.8, state.endsAt];
    state.tempo = steps.findIndex(step => now < step) + 1;
    state.wakeAt = steps[state.tempo - 1];
  },
  view(state, viewerId) {
    return {
      phase: state.phase, round: state.round, rounds: passBomb.rounds, holderId: state.holderId, prompt: state.prompt, passes: state.passes, tempo: state.tempo,
      lastBlastId: state.lastBlastId, seq: state.seq,
      players: state.players.map(p => ({ ...p, blasts: state.blasts[p.id] || 0 })),
      you: viewerId && seated(state, viewerId) ? { holding: state.holderId === viewerId && ['ready', 'ticking'].includes(state.phase) } : null
    };
  }
};

// Most Likely To and Would You Rather: everyone votes in secret, the big screen reveals.
function votingGame({ title, min, rounds, setupPrompts, choose, describe }) {
  const game = {
    title, min, max: 12, rounds, hostActions: ['reveal', 'next'],
    setup() { return { prompts: setupPrompts() }; },
    create(players, rng, setup = game.setup()) {
      const draw = dealer(setup.prompts, rng);
      return { players: players.map(publicPlayer), setup, rng, draw, round: 1, prompt: draw(), phase: 'voting', votes: {}, history: [], seq: 0 };
    },
    act(state, playerId, action, ctx = {}) {
      state.seq += 1;
      if (action.type === 'rematch') {
        if (!ctx.host && state.phase !== 'over') fail('Finish this game first.');
        Object.assign(state, game.create(state.players, state.rng, state.setup), { seq: state.seq + 1 });
        return;
      }
      if (ctx.host && action.type === 'reveal') {
        if (state.phase !== 'voting') fail('Already revealed.');
        if (!Object.keys(state.votes).length) fail('Nobody has voted yet.');
        state.history.push({ prompt: state.prompt, votes: { ...state.votes } });
        state.phase = 'reveal';
        return;
      }
      if (ctx.host && action.type === 'next') {
        if (state.phase !== 'reveal') fail('Reveal the votes first.');
        if (state.round >= rounds) { state.phase = 'over'; return; }
        state.round += 1;
        state.prompt = state.draw();
        state.votes = {};
        state.phase = 'voting';
        return;
      }
      if (ctx.host) fail('That isn’t possible right now.');
      if (!seated(state, playerId)) fail('You’re not seated at this table.');
      if (action.type !== 'vote') fail('Unknown move.');
      if (state.phase !== 'voting') fail('Votes are locked. Watch the big screen!');
      state.votes[playerId] = choose(state, action);
    },
    view(state, viewerId) {
      const shown = state.phase !== 'voting';
      const last = state.history[state.history.length - 1];
      return {
        phase: state.phase, round: state.round, rounds, prompt: state.prompt, seq: state.seq,
        players: state.players.map(p => ({ ...p, voted: Boolean(state.votes[p.id]) })),
        votes: Object.keys(state.votes).length,
        result: shown && last ? { prompt: last.prompt, votes: last.votes } : null,
        summary: state.phase === 'over' ? describe(state) : null,
        you: viewerId && seated(state, viewerId) ? { vote: state.votes[viewerId] || null } : null
      };
    }
  };
  return game;
}
const mostLikely = votingGame({
  title: 'Most Likely To', min: 3, rounds: 10,
  setupPrompts: () => require('./core.js').getGame('most-likely').prompts.map(p => p.text),
  choose(state, action) {
    if (!seated(state, action.targetId)) fail('Pick someone at the table.');
    return action.targetId;
  },
  // Each round's winners (ties share) earn that title.
  describe(state) {
    const titles = {};
    state.history.forEach(({ prompt, votes }) => tally(votes).leaders.forEach(id => { (titles[id] = titles[id] || []).push(prompt); }));
    return { titles };
  }
});
const wouldYouRather = votingGame({
  title: 'Would You Rather', min: 2, rounds: 10,
  setupPrompts: () => require('./core.js').getGame('would-you-rather').prompts.map(p => ({ a: p.optionA, b: p.optionB })),
  choose(state, action) {
    if (!['a', 'b'].includes(action.side)) fail('Pick A or B.');
    return action.side;
  },
  // Rebels are the people who most often ended up on the smaller side.
  describe(state) {
    const rebels = {};
    state.history.forEach(({ votes }) => {
      const picks = Object.values(votes);
      const a = picks.filter(v => v === 'a').length;
      const b = picks.length - a;
      if (a === b) return;
      const minority = a < b ? 'a' : 'b';
      Object.entries(votes).forEach(([id, side]) => { if (side === minority) rebels[id] = (rebels[id] || 0) + 1; });
    });
    return { rebels };
  }
});

const GAMES = { matatu, rps, 'four-row': fourRow, imposter, 'pass-bomb': passBomb, 'most-likely': mostLikely, 'would-you-rather': wouldYouRather };

// ---------------------------------------------------------------------------
// Rooms: a join code, a host key for the laptop, and a private key per phone.
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const token = () => crypto.randomBytes(16).toString('hex');

function createRooms({ rng = Math.random, now = () => Date.now(), maxRooms = 50, idleMs = 6 * 60 * 60 * 1000, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const rooms = new Map();

  function sweep() {
    for (const [code, room] of rooms) if (now() - room.touched > idleMs) { clearTimer(room.timer); room.clients.forEach(client => client.end()); rooms.delete(code); }
  }
  function get(code) {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room) fail('That table doesn’t exist. Check the code on the big screen.');
    room.touched = now();
    return room;
  }
  // Some games wake themselves up (a discussion clock, a hidden fuse) without anyone tapping.
  function schedule(room) {
    clearTimer(room.timer);
    room.timer = null;
    const wake = room.state?.wakeAt;
    if (!wake) return;
    room.timer = setTimer(() => {
      room.timer = null;
      if (rooms.get(room.code) !== room || !room.state) return;
      GAMES[room.gameId].tick?.(room.state, now());
      schedule(room);
      broadcast(room);
    }, Math.max(0, wake - now()));
  }
  function create(gameId, options = {}) {
    sweep();
    if (!GAMES[gameId]) fail('Unknown phone game.');
    const setup = GAMES[gameId].setup ? GAMES[gameId].setup(options || {}) : null;
    if (rooms.size >= maxRooms) fail('Too many open tables. Close one and try again.');
    let code;
    do { code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(rng() * CODE_LETTERS.length)]).join(''); } while (rooms.has(code));
    const room = { code, gameId, setup, hostKey: token(), players: [], state: null, clients: new Set(), touched: now(), version: 0, timer: null };
    rooms.set(code, room);
    return { code, hostKey: room.hostKey };
  }
  function join(code, { name, emoji, playerId, key } = {}) {
    const room = get(code);
    const existing = room.players.find(p => p.id === playerId && p.key === key);
    if (existing) return { playerId: existing.id, key: existing.key };
    if (room.state) fail('This game has already started. Ask the host for a rematch to join.');
    const game = GAMES[room.gameId];
    if (room.players.length >= game.max) fail(`${game.title} is full (${game.max} players max).`);
    let clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 16);
    if (!clean) fail('Type your name to join.');
    const base = clean;
    for (let n = 2; room.players.some(p => p.name.toLowerCase() === clean.toLowerCase()); n += 1) clean = `${base.slice(0, 13)} ${n}`;
    const player = { id: `p${room.players.length + 1}-${token().slice(0, 6)}`, key: token(), name: clean, emoji: FACES.includes(emoji) ? emoji : FACES[room.players.length % FACES.length] };
    room.players.push(player);
    broadcast(room);
    return { playerId: player.id, key: player.key };
  }
  function checkHost(room, hostKey) { if (hostKey !== room.hostKey) fail('Only the big screen can do that.'); }
  function start(code, hostKey) {
    const room = get(code);
    checkHost(room, hostKey);
    const game = GAMES[room.gameId];
    if (room.state) fail('The game is already running.');
    if (room.players.length < game.min) fail(`${game.title} needs at least ${game.min} players.`);
    room.state = game.setup ? game.create(room.players, rng, room.setup, now()) : game.create(room.players, rng);
    schedule(room);
    broadcast(room);
  }
  function remove(code, hostKey, playerId) {
    const room = get(code);
    checkHost(room, hostKey);
    if (room.state) fail('You can only remove players before the game starts.');
    room.players = room.players.filter(p => p.id !== playerId);
    room.clients.forEach(client => { if (client.playerId === playerId) client.end(); });
    broadcast(room);
  }
  function act(code, { playerId, key, hostKey, action } = {}) {
    const room = get(code);
    if (!room.state) fail('Waiting for the host to start.');
    if (!action || typeof action.type !== 'string') fail('Unknown move.');
    const game = GAMES[room.gameId];
    if (hostKey) {
      checkHost(room, hostKey);
      if (action.type !== 'rematch' && !(game.hostActions || []).includes(action.type)) fail('Only players can do that.');
      game.act(room.state, null, action, { host: true, now: now() });
    } else {
      const player = room.players.find(p => p.id === playerId);
      if (!player || player.key !== key) fail('You’re not seated at this table.');
      game.act(room.state, player.id, action, { host: false, now: now() });
    }
    schedule(room);
    broadcast(room);
  }
  function view(room, viewerId) {
    const game = GAMES[room.gameId];
    return { code: room.code, gameId: room.gameId, title: game.title, min: game.min, max: game.max, version: room.version, started: Boolean(room.state), players: room.players.map(publicPlayer), you: viewerId ? publicPlayer(room.players.find(p => p.id === viewerId)) : null, game: room.state ? game.view(room.state, viewerId) : null };
  }
  function broadcast(room) {
    room.version += 1;
    room.clients.forEach(client => client.send(view(room, client.playerId)));
  }
  // client: { playerId, send(view), end() }. Returns an unsubscribe function.
  function subscribe(code, { playerId, key, hostKey }, client) {
    const room = get(code);
    let viewerId = null;
    if (hostKey) checkHost(room, hostKey);
    else {
      const player = room.players.find(p => p.id === playerId);
      if (!player || player.key !== key) fail('You’re not seated at this table.');
      viewerId = player.id;
    }
    const entry = { ...client, playerId: viewerId };
    room.clients.add(entry);
    entry.send(view(room, viewerId));
    return () => room.clients.delete(entry);
  }
  function close(code, hostKey) {
    const room = get(code);
    checkHost(room, hostKey);
    clearTimer(room.timer);
    room.clients.forEach(client => client.end());
    rooms.delete(room.code);
  }
  return { create, join, start, remove, act, subscribe, close, get size() { return rooms.size; } };
}

module.exports = { GAMES, SUITS, RANKS, FACES, GameError, createRooms, matatu, cardPoints, rps, fourRow, imposter, passBomb, mostLikely, wouldYouRather, shuffle };
