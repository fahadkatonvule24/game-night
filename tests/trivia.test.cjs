'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getGame, getCategories } = require('../core.js');
const { createQuestionBank, QUESTIONS_PER_LEVEL, LEVEL_POINTS } = require('../trivia.js');

const prompts = getGame('trivia').prompts;

test('every trivia category has a full team round at every level', () => {
  for (const category of new Set(prompts.map(p => p.category))) {
    for (const level of ['easy', 'medium', 'hard']) {
      const count = prompts.filter(p => p.category === category && p.difficulty === level).length;
      assert.ok(count >= QUESTIONS_PER_LEVEL, `${category} ${level} has ${count}`);
    }
  }
  assert.deepEqual(LEVEL_POINTS, { easy: 1, medium: 2, hard: 3 });
  const labels = getCategories('trivia').map(c => c.label);
  for (const label of ['Uganda', 'Africa', 'Sports', 'Science & space', 'World history']) assert.ok(labels.includes(label), label);
});

test('the question bank shuffles choices but keeps the right answer', () => {
  let seed = 7;
  const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const bank = createQuestionBank(prompts, 'all', rng);
  for (let i = 0; i < 40; i += 1) {
    const question = bank.draw('medium');
    const original = prompts.find(p => p.text === question.text);
    assert.equal(question.difficulty, 'medium');
    assert.deepEqual([...question.options].sort(), [...original.options].sort());
    assert.equal(question.options[question.answer], original.options[original.answer]);
  }
});

test('a thin category borrows from the same level before repeating anything', () => {
  const bank = createQuestionBank(prompts, 'capitals', Math.random);
  const drawn = Array.from({ length: 25 }, () => bank.draw('easy'));
  assert.equal(new Set(drawn.map(q => q.text)).size, 25);
  assert.ok(drawn.slice(0, 10).every(q => q.category === 'capitals'));
  assert.ok(drawn.every(q => q.difficulty === 'easy'));
  const tiny = createQuestionBank(prompts.slice(0, 2), 'all', Math.random);
  const texts = [tiny.draw('hard'), tiny.draw('hard'), tiny.draw('hard')].map(q => q.text);
  assert.equal(new Set(texts.slice(0, 2)).size, 2, 'repeats only once every question is used');
  assert.throws(() => createQuestionBank([], 'all'), /at least one question/);
});
