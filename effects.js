(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GameNightEffects = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const COLORS = ['#fa7655', '#c9e07a', '#a38cce', '#7ba9c4', '#e8b843', '#d88da0', '#66a69f'];
  const DURATION = 2600;
  const MAX_PIECES = 220;
  const active = new Set();

  const between = (min, max, rng) => min + (max - min) * rng();

  // Pieces launch upward from a band across the target, then fall and fade. Pure data so it can be tested.
  function createPieces(width, height, count = 90, rng = Math.random) {
    const total = Math.max(0, Math.min(MAX_PIECES, Math.floor(count) || 0));
    return Array.from({ length: total }, () => ({
      x: width / 2 + between(-width * 0.3, width * 0.3, rng),
      y: height * between(0.35, 0.55, rng),
      vx: between(-6, 6, rng),
      vy: between(-14, -5, rng),
      size: between(6, 11, rng),
      spin: between(-0.25, 0.25, rng),
      angle: between(0, Math.PI * 2, rng),
      round: rng() < 0.3,
      color: COLORS[Math.floor(rng() * COLORS.length)]
    }));
  }

  function step(pieces, frames = 1) {
    for (const piece of pieces) {
      piece.vy += 0.32 * frames;
      piece.vx *= Math.pow(0.99, frames);
      piece.x += piece.vx * frames;
      piece.y += piece.vy * frames;
      piece.angle += piece.spin * frames;
    }
    return pieces;
  }

  function reducedMotion() {
    try { return Boolean(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches); }
    catch { return false; }
  }

  // Returns false (and draws nothing) when motion is reduced or canvas is unavailable.
  function confetti(target, options = {}) {
    const doc = root.document;
    if (!doc || !target || typeof target.append !== 'function' || reducedMotion()) return false;
    if (typeof root.requestAnimationFrame !== 'function') return false;
    const canvas = doc.createElement('canvas');
    let context = null;
    try { context = canvas.getContext('2d'); } catch { context = null; }
    if (!context) return false;
    canvas.className = 'confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    target.append(canvas);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || root.innerWidth || 600);
    const height = Math.max(1, rect.height || root.innerHeight || 400);
    const ratio = Math.min(2, root.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.scale(ratio, ratio);
    const pieces = createPieces(width, height, options.count);
    const started = root.performance?.now?.() ?? Date.now();
    let last = started;
    const run = { canvas, frame: 0 };
    active.add(run);

    function draw(now) {
      if (!active.has(run)) return;
      const elapsed = now - started;
      step(pieces, Math.min(3, Math.max(0.2, (now - last) / 16.7)));
      last = now;
      context.clearRect(0, 0, width, height);
      context.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - DURATION * 0.6) / (DURATION * 0.4));
      for (const piece of pieces) {
        if (piece.y > height + 20) continue;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.angle);
        context.fillStyle = piece.color;
        if (piece.round) { context.beginPath(); context.arc(0, 0, piece.size / 2.4, 0, Math.PI * 2); context.fill(); }
        else context.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
        context.restore();
      }
      if (elapsed < DURATION) run.frame = root.requestAnimationFrame(draw);
      else stop(run);
    }
    run.frame = root.requestAnimationFrame(draw);
    return true;
  }

  function stop(run) {
    active.delete(run);
    try { root.cancelAnimationFrame?.(run.frame); } catch { /* Already finished. */ }
    run.canvas.remove();
  }

  function clear() {
    for (const run of [...active]) stop(run);
    root.document?.querySelectorAll('.float-emoji').forEach(node => node.remove());
  }

  // A reaction emoji that drifts up the target and fades. Capped so a button-masher can't flood the page.
  function floatEmoji(target, emoji, rng = Math.random) {
    const doc = root.document;
    if (!doc || !target || typeof target.append !== 'function' || reducedMotion()) return false;
    if (target.querySelectorAll('.float-emoji').length >= 24) return false;
    const node = doc.createElement('span');
    node.className = 'float-emoji';
    node.setAttribute('aria-hidden', 'true');
    node.textContent = String(emoji);
    node.style.left = `${Math.round(between(8, 88, rng))}%`;
    node.style.setProperty('--drift', `${Math.round(between(-60, 60, rng))}px`);
    node.style.setProperty('--spin', `${Math.round(between(-25, 25, rng))}deg`);
    target.append(node);
    root.setTimeout(() => node.remove(), 2200);
    return true;
  }

  return Object.freeze({ confetti, clear, createPieces, step, floatEmoji });
});
