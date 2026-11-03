(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GameNightSounds = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  // Short, original synthesised cues. Nothing is downloaded or played on load.
  // [start offset, pitch, length, oscillator, final pitch, relative gain]
  const cues = {
    start: [[0, 392, .09, 'sine'], [.13, 494, .09, 'sine'], [.26, 659, .23, 'triangle']],
    correct: [[0, 523, .12, 'sine'], [.10, 784, .22, 'sine']],
    wrong: [[0, 220, .19, 'sine', 165], [.13, 165, .16, 'sine', 147, .65]],
    skip: [[0, 440, .09, 'triangle', 330, .6]],
    tick: [[0, 880, .045, 'sine', 740, .45]],
    finish: [[0, 523, .18, 'sine'], [.12, 659, .18, 'sine'], [.24, 784, .34, 'sine']],
    reveal: [[0, 294, .13, 'sine'], [.08, 392, .18, 'sine', null, .65]],
    levelup: [[0, 392, .12, 'triangle'], [.10, 523, .12, 'triangle'], [.20, 659, .12, 'triangle'], [.30, 784, .28, 'sine']],
    shuffle: [[0, 330, .06, 'triangle', 440, .65], [.08, 494, .06, 'triangle', 392, .65], [.16, 440, .06, 'triangle', 587, .65], [.25, 659, .14, 'sine', null, .7]],
    streak: [[0, 659, .08, 'square', null, .35], [.07, 784, .08, 'square', null, .35], [.14, 1047, .2, 'triangle', 1175, .7]],
    champion: [[0, 523, .16, 'triangle'], [.16, 659, .16, 'triangle'], [.32, 784, .16, 'triangle'], [.5, 1047, .45, 'sine', null, .9]],
    lockin: [[0, 196, .1, 'triangle', null, .7], [.15, 196, .1, 'triangle', null, .7], [.3, 247, .1, 'triangle', null, .8], [.45, 294, .24, 'triangle', 330, .9]],
    buzzer: [[0, 147, .42, 'square', 131, .45], [0, 156, .42, 'sawtooth', 139, .25]],
    whistle: [[0, 1568, .16, 'sine', 1760, .5], [.2, 1568, .34, 'sine', 1397, .5]],
    pop: [[0, 660, .06, 'sine', 990, .45]],
    spotlight: [[0, 262, .12, 'sine', 392, .55], [.1, 392, .14, 'sine', 523, .6], [.22, 523, .3, 'triangle', 784, .8]]
  };
  const MAX_VOICES = 16;
  const clamp = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : fallback;

  function create(options = {}) {
    let enabled = options.enabled !== false;
    let volume = clamp(options.volume === undefined ? .45 : options.volume, .45);
    let context = null;
    let master = null;
    let unlocked = false;
    let destroyed = false;
    let pendingUnlock = null;
    let unavailableReported = false;
    const voices = new Set();

    function reportUnavailable() {
      if (unavailableReported) return;
      unavailableReported = true;
      try { if (typeof options.onUnavailable === 'function') options.onUnavailable(); }
      catch { /* A notification cannot interrupt a game. */ }
    }

    // Call this from a click/tap. AudioContext construction and resume are kept
    // inside this method so page load, timers and restored preferences stay quiet.
    function unlock() {
      if (destroyed || !enabled) return Promise.resolve(false);
      if (pendingUnlock) return pendingUnlock;
      try {
        if (!context || context.state === 'closed') {
          const Context = root.AudioContext || root.webkitAudioContext;
          if (typeof Context !== 'function') { reportUnavailable(); return Promise.resolve(false); }
          context = new Context();
          master = context.createGain();
          master.gain.setValueAtTime(volume, context.currentTime);
          master.connect(context.destination);
        }
        const result = context.state === 'running' ? undefined : context.resume();
        pendingUnlock = Promise.resolve(result).then(() => {
          unlocked = !destroyed && enabled && context.state === 'running';
          return unlocked;
        }).catch(() => {
          unlocked = false;
          reportUnavailable();
          return false;
        }).finally(() => { pendingUnlock = null; });
        return pendingUnlock;
      } catch {
        unlocked = false;
        reportUnavailable();
        return Promise.resolve(false);
      }
    }

    function disconnectVoice(voice) {
      voices.delete(voice);
      voice.oscillator.onended = null;
      try { voice.oscillator.disconnect(); } catch { /* Already detached. */ }
      try { voice.gain.disconnect(); } catch { /* Already detached. */ }
    }

    function stopVoice(voice) {
      try { voice.oscillator.stop(context?.currentTime || 0); } catch { /* Already stopped. */ }
      disconnectVoice(voice);
    }

    function stop() {
      for (const voice of [...voices]) stopVoice(voice);
    }

    function play(cue) {
      if (destroyed || !enabled || !unlocked || !context || context.state !== 'running' || volume <= 0) return false;
      const notes = Object.prototype.hasOwnProperty.call(cues, cue) ? cues[cue] : null;
      if (!notes) return false;
      try {
        for (const [offset, frequency, length, shape, finalFrequency, strength = 1] of notes) {
          if (voices.size >= MAX_VOICES) stopVoice(voices.values().next().value);
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const voice = { oscillator, gain };
          voices.add(voice);
          oscillator.onended = () => disconnectVoice(voice);
          oscillator.type = shape;
          const start = context.currentTime + offset;
          const end = start + length;
          oscillator.frequency.setValueAtTime(frequency, start);
          if (finalFrequency) oscillator.frequency.exponentialRampToValueAtTime(finalFrequency, end);
          gain.gain.setValueAtTime(.0001, start);
          gain.gain.linearRampToValueAtTime(.14 * strength, start + Math.min(.012, length / 4));
          gain.gain.exponentialRampToValueAtTime(.0001, end);
          oscillator.connect(gain);
          gain.connect(master);
          oscillator.start(start);
          oscillator.stop(end + .006);
        }
        return true;
      } catch {
        stop();
        unlocked = false;
        reportUnavailable();
        return false;
      }
    }

    function setEnabled(value) {
      enabled = Boolean(value);
      if (!enabled) { unlocked = false; stop(); }
      // Turning the switch on still needs unlock() from that same user gesture.
      return enabled;
    }

    function setVolume(value) {
      volume = clamp(value, volume);
      if (volume === 0) stop();
      if (master && context && context.state !== 'closed') {
        try {
          master.gain.cancelScheduledValues(context.currentTime);
          master.gain.setValueAtTime(volume, context.currentTime);
        } catch { /* Optional audio must not break play. */ }
      }
      return volume;
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      unlocked = false;
      stop();
      try { master?.disconnect(); } catch { /* Already detached. */ }
      try {
        if (context && context.state !== 'closed') Promise.resolve(context.close()).catch(() => {});
      } catch { /* Browsers may have closed it already. */ }
    }

    return Object.freeze({ unlock, play, setEnabled, setVolume, stop, destroy });
  }

  return Object.freeze({ create });
});
