'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { GAMES, TEAM_PALETTE, LEVELS, PROMPTS_PER_LEVEL, shuffle, createTeams, createDeck, getGame, getCategories, getDifficulty, categoryLabel } = require('../core.js');
const { createMatch, resolveVotes, normalizeGuess } = require('../imposter.js');

const players = count => Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `Guest ${index + 1}` }));

test('balanced groups include every player exactly once for every supported size', () => {
  for (let playerCount = 2; playerCount <= 40; playerCount += 1) {
    for (let teamCount = 2; teamCount <= Math.min(8, playerCount); teamCount += 1) {
      const roster = players(playerCount);
      const teams = createTeams(roster, teamCount);
      const sizes = teams.map(team => team.players.length);
      assert.equal(teams.length, teamCount);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
      assert.ok(sizes.every(size => size >= 1));
      assert.deepEqual(teams.flatMap(team => team.players.map(player => player.id)).sort(), roster.map(player => player.id).sort());
      assert.equal(new Set(teams.flatMap(team => team.players.map(player => player.id))).size, playerCount);
      assert.ok(teams.every(team => team.score === 0));
    }
  }
});

test('team generation does not mutate player data and returns separate player records', () => {
  const roster = players(7);
  const before = JSON.stringify(roster);
  const teams = createTeams(roster, 3, () => 0.5);
  assert.equal(JSON.stringify(roster), before);
  const first = teams[0].players[0];
  first.name = 'Changed';
  assert.equal(JSON.stringify(roster), before);
});

test('blank names have predictable defaults and duplicate display names are allowed', () => {
  const teams = createTeams([{ id: 1, name: '  ' }, { id: 2, name: ' Alex ' }, { id: 3, name: 'Alex' }], 2, () => 0.9);
  assert.deepEqual(teams.flatMap(team => team.players).sort((a, b) => a.id - b.id), [
    { id: 1, name: 'Player 1' }, { id: 2, name: 'Alex' }, { id: 3, name: 'Alex' }
  ]);
});

test('grouping rejects unsupported sizes, invalid counts and malformed player records', () => {
  for (const roster of [null, [], players(1), players(41)]) assert.throws(() => createTeams(roster, 2));
  for (const count of [0, 1, 9, 2.5, NaN, '2', undefined]) assert.throws(() => createTeams(players(10), count));
  assert.throws(() => createTeams(players(2), 3));
  assert.throws(() => createTeams([{ id: 1 }, { id: 1 }], 2));
  assert.throws(() => createTeams([{ id: 1 }, { id: '1' }], 2));
  assert.throws(() => createTeams([{ id: 'a' }, { name: 'Missing ID' }], 2));
  assert.throws(() => createTeams([{ id: 'a' }, null], 2));
  assert.throws(() => createTeams([{ id: 'a', name: 5 }, { id: 'b' }], 2));
  assert.throws(() => createTeams([{ id: '' }, { id: 'b' }], 2));
  assert.throws(() => createTeams([{ id: Infinity }, { id: 'b' }], 2));
});

test('Fisher-Yates shuffle honors its random source without changing input', () => {
  const source = ['a', 'b', 'c', 'd'];
  assert.deepEqual(shuffle(source, () => 0), ['b', 'c', 'd', 'a']);
  assert.deepEqual(shuffle(source, () => 0.999999), source);
  assert.deepEqual(source, ['a', 'b', 'c', 'd']);
  assert.notEqual(shuffle(source), source);
  assert.deepEqual(shuffle([]), []);
  assert.deepEqual(shuffle(['only']), ['only']);
  for (const invalid of [-1, 1, NaN, Infinity, '0.5']) assert.throws(() => shuffle(source, () => invalid));
  assert.throws(() => shuffle('not an array'));
  assert.throws(() => shuffle(source, 5));
});

test('two distinct RNG streams produce different balanced groupings', () => {
  const roster = players(8);
  assert.notDeepEqual(createTeams(roster, 2, () => 0), createTeams(roster, 2, () => 0.999999));
  assert.deepEqual(createTeams(roster, 2, () => 0.4), createTeams(roster, 2, () => 0.4));
});

test('all fifteen games contain usable metadata, and every prompt game has at least 30 unique prompts', () => {
  assert.deepEqual(GAMES.map(game => game.id), ['charades', 'taboo', 'trivia', 'quickdraw', 'five-second', 'who-am-i', 'emoji-decode', 'imposter', 'categories', 'would-you-rather', 'most-likely', 'pass-bomb', 'matatu', 'rps', 'four-row']);
  for (const game of GAMES) {
    for (const key of ['title', 'tagline', 'description', 'duration', 'badge', 'icon', 'color']) assert.equal(typeof game[key], 'string');
    assert.ok(['team', 'social', 'icebreaker', 'phones'].includes(game.category));
    assert.ok(game.minPlayers >= 2);
    assert.ok(game.rules.length >= 3);
    assert.equal(game.category === 'phones', Boolean(game.phone), `${game.id} is played on phones`);
    if (game.phone) { assert.equal(game.prompts.length, 0); assert.ok(game.maxPlayers >= game.minPlayers); continue; }
    assert.ok(game.prompts.length >= 30);
    assert.equal(new Set(game.prompts.map(prompt => JSON.stringify(prompt))).size, game.prompts.length);
    assert.ok(game.prompts.every(prompt => typeof prompt.text === 'string' && prompt.text.length > 0));
    assert.equal(getGame(game.id), game);
  }
  assert.equal(getGame('missing'), undefined);
  assert.equal(TEAM_PALETTE.length, 8);
  assert.equal(new Set(TEAM_PALETTE.map(team => team.name)).size, 8);
});

test('trivia options, taboo words and dilemma choices are complete', () => {
  for (const prompt of getGame('trivia').prompts) {
    assert.equal(prompt.options.length, 4);
    assert.equal(new Set(prompt.options).size, 4);
    assert.ok(Number.isInteger(prompt.answer) && prompt.answer >= 0 && prompt.answer <= 3);
    assert.equal(typeof prompt.options[prompt.answer], 'string');
  }
  for (const prompt of getGame('taboo').prompts) {
    assert.ok(prompt.forbidden.length >= 4 && prompt.forbidden.length <= 5);
    assert.equal(new Set(prompt.forbidden).size, prompt.forbidden.length);
  }
  for (const prompt of getGame('would-you-rather').prompts) {
    assert.equal(typeof prompt.optionA, 'string');
    assert.equal(typeof prompt.optionB, 'string');
    assert.notEqual(prompt.optionA, prompt.optionB);
  }
  for (const id of ['charades', 'quickdraw', 'who-am-i', 'five-second', 'imposter']) assert.ok(getGame(id).prompts.every(prompt => typeof prompt.category === 'string'));
});

test('decks contain all prompts once and protect catalog data from mutation', () => {
  for (const game of GAMES.filter(g => !g.phone)) {
    const deck = createDeck(game.id, () => 0.999999);
    assert.deepEqual(deck, game.prompts);
    assert.notEqual(deck, game.prompts);
    assert.notEqual(deck[0], game.prompts[0]);
    deck[0].text = 'Modified';
    assert.notEqual(deck[0].text, game.prompts[0].text);
    if (deck[0].options) {
      deck[0].options[0] = 'Modified';
      assert.notEqual(deck[0].options[0], game.prompts[0].options[0]);
    }
    if (deck[0].forbidden) {
      deck[0].forbidden[0] = 'Modified';
      assert.notEqual(deck[0].forbidden[0], game.prompts[0].forbidden[0]);
    }
  }
  assert.throws(() => createDeck('missing'));
  assert.ok(Object.isFrozen(GAMES));
  assert.ok(Object.isFrozen(GAMES[0].prompts[0]));
  assert.ok(Object.isFrozen(TEAM_PALETTE));
});

test('levelled games offer at least four prompts for every category at every level', () => {
  const levelled = GAMES.filter(game => game.supportsDifficulty).map(game => game.id);
  assert.deepEqual(levelled, ['charades', 'taboo', 'trivia', 'quickdraw', 'five-second', 'who-am-i', 'emoji-decode']);
  for (const id of levelled) {
    for (const { id: category } of getCategories(id)) {
      for (const difficulty of LEVELS) {
        const matching = getGame(id).prompts.filter(prompt => prompt.category === category && prompt.difficulty === difficulty);
        assert.ok(matching.length >= PROMPTS_PER_LEVEL, `${id} · ${category} · ${difficulty}`);
      }
    }
  }
  assert.deepEqual(getCategories('charades').map(c => c.id), ['capitals', 'countries', 'animals', 'artists', 'everyday']);
  assert.equal(categoryLabel('capitals'), 'Capital cities');
  assert.deepEqual(getCategories('categories'), []);
  assert.deepEqual(getCategories('missing'), []);
});

test('auto difficulty climbs every four prompts and fixed modes stay put', () => {
  assert.deepEqual([0, 3, 4, 7, 8, 500].map(played => getDifficulty(played)), ['easy', 'easy', 'medium', 'medium', 'hard', 'hard']);
  for (const invalid of [-1, 1.5, NaN, '9', undefined]) assert.equal(getDifficulty(invalid), 'easy');
  for (const level of LEVELS) assert.equal(getDifficulty(0, level), level);
  assert.equal(getDifficulty(6, 'unknown'), 'medium');
});

test('filtered decks match their category and level, and fall back instead of running empty', () => {
  const deck = createDeck('charades', Math.random, { category: 'capitals', difficulty: 'hard' });
  assert.equal(deck.length, 6);
  assert.ok(deck.every(prompt => prompt.category === 'capitals' && prompt.difficulty === 'hard'));
  assert.ok(deck.some(prompt => prompt.text === 'Canberra'));
  assert.ok(createDeck('trivia', Math.random, { difficulty: 'medium' }).every(prompt => prompt.difficulty === 'medium'));
  assert.equal(createDeck('taboo', Math.random, { category: 'nope' }).length, getGame('taboo').prompts.length);
  assert.equal(createDeck('categories', Math.random, { difficulty: 'hard' }).length, getGame('categories').prompts.length);
});

test('imposter matches pick one imposter and resolve private votes', () => {
  const roster = players(4);
  const match = createMatch(roster, { text: 'Penguin', label: 'Animals' }, () => 0);
  assert.equal(match.players.length, 4);
  assert.ok(roster.some(player => player.id === match.imposterId));
  assert.equal(match.word, 'Penguin');
  assert.equal(match.category, 'Animals');
  for (const invalid of [players(2), players(13), null]) assert.throws(() => createMatch(invalid, { text: 'Penguin' }));
  assert.throws(() => createMatch(roster, { text: '  ' }));
  const others = match.players.filter(player => player.id !== match.imposterId);
  const caught = resolveVotes(match, match.players.map(voter => ({ voterId: voter.id, targetId: voter.id === match.imposterId ? others[0].id : match.imposterId })));
  assert.equal(caught.outcome, 'imposter-caught');
  assert.equal(caught.accusedId, match.imposterId);
  const [a, b, c, d] = match.players.map(player => player.id);
  assert.equal(resolveVotes(match, [{ voterId: a, targetId: b }, { voterId: b, targetId: a }, { voterId: c, targetId: d }, { voterId: d, targetId: c }]).outcome, 'tie');
  assert.throws(() => resolveVotes(match, [{ voterId: a, targetId: a }, { voterId: b, targetId: a }, { voterId: c, targetId: a }, { voterId: d, targetId: a }]));
  assert.throws(() => resolveVotes(match, []));
  assert.equal(normalizeGuess('  Crème Brûlée! '), 'cremebrulee');
});
