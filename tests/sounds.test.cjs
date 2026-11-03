'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'sounds.js'), 'utf8');

function environment({ supported = true, resumeFails = false, deferred = false } = {}) {
  const instances = [];
  let resumeResolve;
  const parameter = () => ({ value: null, events: [], setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }, linearRampToValueAtTime(value, time) { this.events.push(['linear', value, time]); }, exponentialRampToValueAtTime(value, time) { this.events.push(['exponential', value, time]); }, cancelScheduledValues(time) { this.events.push(['cancel', time]); } });
  class FakeAudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 10; this.destination = {}; this.oscillators = []; this.gains = []; this.resumeCalls = 0; this.closeCalls = 0; instances.push(this); }
    createGain() { const gain = { gain: parameter(), disconnected: false, connect(target) { this.target = target; }, disconnect() { this.disconnected = true; } }; this.gains.push(gain); return gain; }
    createOscillator() { const oscillator = { frequency: parameter(), starts: [], stops: [], disconnected: false, onended: null, connect(target) { this.target = target; }, disconnect() { this.disconnected = true; }, start(time) { this.starts.push(time); }, stop(time) { this.stops.push(time); } }; this.oscillators.push(oscillator); return oscillator; }
    resume() { this.resumeCalls++; if (resumeFails) return Promise.reject(new Error('Audio is not available')); if (deferred) return new Promise(resolve => { resumeResolve = () => { if (this.state !== 'closed') this.state = 'running'; resolve(); }; }); this.state = 'running'; return Promise.resolve(); }
    close() { this.closeCalls++; this.state = 'closed'; return Promise.resolve(); }
  }
  const sandbox = { AudioContext: supported ? FakeAudioContext : undefined };
  vm.runInNewContext(source, sandbox);
  return { create: sandbox.GameNightSounds.create, instances, resolveResume: () => resumeResolve() };
}

test('sounds stay silent on construction and before a user-triggered unlock', async () => {
  const env = environment();
  const sound = env.create();
  assert.equal(env.instances.length, 0);
  assert.equal(sound.play('start'), false);
  assert.equal(env.instances.length, 0);
  assert.equal(await sound.unlock(), true);
  assert.equal(env.instances.length, 1);
  assert.equal(env.instances[0].resumeCalls, 1);
  assert.equal(sound.play('correct'), true);
  assert.equal(env.instances[0].oscillators.length, 2);
  assert.ok(env.instances[0].oscillators.every(voice => voice.starts.length === 1));
  sound.destroy();
});

test('all cues are finite and the countdown tick is shorter than 80 ms', async () => {
  const env = environment();
  const sound = env.create();
  await sound.unlock();
  const context = env.instances[0];
  for (const cue of ['start', 'correct', 'wrong', 'skip', 'tick', 'finish', 'reveal', 'levelup', 'shuffle', 'streak', 'champion', 'lockin', 'buzzer', 'whistle', 'spotlight', 'pop']) {
    const before = context.oscillators.length;
    assert.equal(sound.play(cue), true, cue);
    const newVoices = context.oscillators.slice(before);
    assert.ok(newVoices.length > 0 && newVoices.length <= 4);
    for (const voice of newVoices) {
      assert.ok(Number.isFinite(voice.starts[0]));
      assert.ok(voice.stops[0] > voice.starts[0]);
      assert.ok(voice.stops[0] - voice.starts[0] < .5);
      if (cue === 'tick') assert.ok(voice.stops[0] - voice.starts[0] <= .08);
    }
    sound.stop();
  }
  assert.equal(sound.play('__proto__'), false);
  assert.equal(sound.play('missing-cue'), false);
  sound.destroy();
});

test('muting cancels queued voices and turning sound on requires unlock again', async () => {
  const env = environment();
  const sound = env.create();
  await sound.unlock();
  sound.play('levelup');
  const context = env.instances[0];
  assert.ok(context.oscillators.some(voice => voice.starts[0] > context.currentTime));
  sound.setEnabled(false);
  assert.ok(context.oscillators.every(voice => voice.stops.at(-1) === context.currentTime && voice.disconnected));
  const count = context.oscillators.length;
  assert.equal(sound.play('correct'), false);
  assert.equal(await sound.unlock(), false);
  sound.setEnabled(true);
  assert.equal(sound.play('correct'), false);
  assert.equal(await sound.unlock(), true);
  sound.play('correct');
  assert.equal(context.oscillators.length, count + 2);
  sound.destroy();
});

test('volume clamps to a safe range and zero cancels all notes', async () => {
  const env = environment();
  const sound = env.create({ volume: 2 });
  await sound.unlock();
  const context = env.instances[0];
  assert.equal(context.gains[0].gain.value, 1);
  assert.equal(sound.setVolume(.25), .25);
  assert.equal(context.gains[0].gain.value, .25);
  assert.equal(sound.setVolume(NaN), .25);
  sound.play('finish');
  assert.equal(sound.setVolume(-2), 0);
  assert.equal(context.gains[0].gain.value, 0);
  assert.ok(context.oscillators.every(voice => voice.disconnected));
  assert.equal(sound.play('tick'), false);
  sound.destroy();
});

test('unsupported or rejected audio is optional and reports unavailability only once', async () => {
  for (const options of [{ supported: false }, { resumeFails: true }]) {
    const env = environment(options);
    let notices = 0;
    const sound = env.create({ onUnavailable() { notices++; } });
    assert.equal(await sound.unlock(), false);
    assert.equal(await sound.unlock(), false);
    assert.equal(sound.play('reveal'), false);
    assert.equal(notices, 1);
    sound.destroy();
  }
});

test('concurrent unlocks share one context and destroy wins an in-flight resume', async () => {
  const env = environment({ deferred: true });
  const sound = env.create();
  const one = sound.unlock();
  const two = sound.unlock();
  assert.equal(one, two);
  assert.equal(env.instances.length, 1);
  sound.destroy();
  env.resolveResume();
  assert.equal(await one, false);
  assert.equal(sound.play('start'), false);
  assert.equal(await sound.unlock(), false);
  assert.equal(env.instances[0].closeCalls, 1);
  sound.destroy();
  assert.equal(env.instances[0].closeCalls, 1);
});

test('ended voices disconnect and a rapid burst never leaves more than sixteen voices connected', async () => {
  const env = environment();
  const sound = env.create();
  await sound.unlock();
  sound.play('tick');
  const context = env.instances[0];
  const finished = context.oscillators[0];
  finished.onended();
  assert.equal(finished.disconnected, true);
  assert.equal(context.gains[1].disconnected, true);
  for (let i = 0; i < 20; i++) sound.play('levelup');
  assert.ok(context.oscillators.filter(voice => !voice.disconnected).length <= 16);
  sound.destroy();
  assert.ok(context.oscillators.every(voice => voice.disconnected));
  assert.ok(context.gains.every(gain => gain.disconnected));
});
