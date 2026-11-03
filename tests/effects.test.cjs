'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { confetti, clear, createPieces, step } = require('../effects.js');

test('confetti pieces launch upward inside the target, then gravity pulls them down', () => {
  const pieces = createPieces(400, 300, 50, () => 0.5);
  assert.equal(pieces.length, 50);
  assert.ok(pieces.every(piece => piece.x >= 0 && piece.x <= 400 && piece.vy < 0));
  const startY = pieces[0].y;
  step(pieces, 10);
  assert.ok(pieces[0].y < startY, 'still rising early on');
  step(pieces, 200);
  assert.ok(pieces[0].y > 300, 'eventually falls out of view');
  assert.equal(createPieces(100, 100, 5000).length, 220);
  assert.equal(createPieces(100, 100, -3).length, 0);
});

test('confetti is a safe no-op without a document or target', () => {
  assert.equal(confetti(null), false);
  assert.equal(confetti({}), false);
  clear();
});
