(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GameNightQR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // A small QR code encoder: byte mode, error correction level M, versions 1–10.
  // That fits links of up to 213 bytes, plenty for a join link on the local network.
  // [ec codewords per block, blocks in group 1, data codewords per group-1 block, blocks in group 2]
  const BLOCKS = [null, [10, 1, 16, 0], [16, 1, 28, 0], [26, 1, 44, 0], [18, 2, 32, 0], [24, 2, 43, 0], [16, 4, 27, 0], [18, 4, 31, 0], [22, 2, 38, 2], [22, 3, 36, 2], [26, 4, 43, 1]];
  const ALIGNMENT = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  const MAX_VERSION = 10;

  const bit = (value, index) => ((value >>> index) & 1) !== 0;
  const dataCapacity = version => { const [, g1, d1, g2] = BLOCKS[version]; return g1 * d1 + g2 * (d1 + 1); };

  function gfMultiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i -= 1) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  function rsDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let rootValue = 1;
    for (let i = 0; i < degree; i += 1) {
      for (let j = 0; j < result.length; j += 1) {
        result[j] = gfMultiply(result[j], rootValue);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      rootValue = gfMultiply(rootValue, 0x02);
    }
    return result;
  }
  function rsRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    for (const byte of data) {
      const factor = byte ^ result.shift();
      result.push(0);
      divisor.forEach((coefficient, i) => { result[i] ^= gfMultiply(coefficient, factor); });
    }
    return result;
  }

  function encodeData(bytes) {
    let version = 1;
    for (; version <= MAX_VERSION; version += 1) {
      const countBits = version < 10 ? 8 : 16;
      if (4 + countBits + bytes.length * 8 <= dataCapacity(version) * 8) break;
    }
    if (version > MAX_VERSION) throw new RangeError('That link is too long for a QR code.');
    const bits = [];
    const push = (value, length) => { for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1); };
    push(0b0100, 4);
    push(bytes.length, version < 10 ? 8 : 16);
    bytes.forEach(byte => push(byte, 8));
    const capacity = dataCapacity(version) * 8;
    push(0, Math.min(4, capacity - bits.length));
    push(0, (8 - bits.length % 8) % 8);
    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) codewords.push(bits.slice(i, i + 8).reduce((byte, b) => (byte << 1) | b, 0));
    for (let pad = 0xec; codewords.length < capacity / 8; pad ^= 0xec ^ 0x11) codewords.push(pad);
    return { version, codewords };
  }

  function interleave(version, codewords) {
    const [ecLength, group1, dataLength, group2] = BLOCKS[version];
    const divisor = rsDivisor(ecLength);
    const blocks = [];
    let offset = 0;
    for (let i = 0; i < group1 + group2; i += 1) {
      const length = dataLength + (i < group1 ? 0 : 1);
      const data = codewords.slice(offset, offset + length);
      offset += length;
      blocks.push({ data, ec: rsRemainder(data, divisor) });
    }
    const result = [];
    for (let i = 0; i <= dataLength; i += 1) blocks.forEach(block => { if (i < block.data.length) result.push(block.data[i]); });
    for (let i = 0; i < ecLength; i += 1) blocks.forEach(block => result.push(block.ec[i]));
    return result;
  }

  function buildMatrix(version, data, mask) {
    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => { if (x >= 0 && y >= 0 && x < size && y < size) { modules[y][x] = dark; reserved[y][x] = true; } };

    for (let i = 0; i < size; i += 1) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
      for (let dy = -4; dy <= 4; dy += 1) for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, distance !== 2 && distance !== 4);
      }
    }
    const positions = ALIGNMENT[version];
    positions.forEach((ay, i) => positions.forEach((ax, j) => {
      const last = positions.length - 1;
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));

    // Format bits: level M (00) plus the mask, protected by a BCH code.
    let remainder = mask;
    for (let i = 0; i < 10; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    const format = ((mask << 10) | remainder) ^ 0x5412;
    for (let i = 0; i <= 5; i += 1) set(8, i, bit(format, i));
    set(8, 7, bit(format, 6));
    set(8, 8, bit(format, 7));
    set(7, 8, bit(format, 8));
    for (let i = 9; i < 15; i += 1) set(14 - i, 8, bit(format, i));
    for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, bit(format, i));
    for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, bit(format, i));
    set(8, size - 8, true);

    if (version >= 7) {
      let rem = version;
      for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const bits = (version << 12) | rem;
      for (let i = 0; i < 18; i += 1) {
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        set(a, b, bit(bits, i));
        set(b, a, bit(bits, i));
      }
    }

    let index = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < size; vertical += 1) {
        for (let j = 0; j < 2; j += 1) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vertical : vertical;
          if (reserved[y][x] || index >= data.length * 8) continue;
          modules[y][x] = bit(data[index >>> 3], 7 - (index & 7));
          index += 1;
        }
      }
    }

    const flips = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0
    ];
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) if (!reserved[y][x] && flips[mask](x, y)) modules[y][x] = !modules[y][x];
    return modules;
  }

  // Lower is better: long runs, 2×2 blocks, finder look-alikes and an unbalanced dark ratio all cost points.
  function penalty(modules) {
    const size = modules.length;
    let score = 0;
    const lines = [];
    for (let i = 0; i < size; i += 1) { lines.push(modules[i]); lines.push(modules.map(row => row[i])); }
    for (const line of lines) {
      let run = 1;
      for (let i = 1; i <= size; i += 1) {
        if (i < size && line[i] === line[i - 1]) { run += 1; continue; }
        if (run >= 5) score += run - 2;
        run = 1;
      }
      const text = line.map(dark => (dark ? '1' : '0')).join('');
      score += 40 * ((text.match(/(?=10111010000)/g) || []).length + (text.match(/(?=00001011101)/g) || []).length);
    }
    for (let y = 0; y < size - 1; y += 1) for (let x = 0; x < size - 1; x += 1) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
    }
    const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
    score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    return score;
  }

  function encode(text) {
    const bytes = [...new TextEncoder().encode(String(text))];
    const { version, codewords } = encodeData(bytes);
    const data = interleave(version, codewords);
    let best = null;
    for (let mask = 0; mask < 8; mask += 1) {
      const modules = buildMatrix(version, data, mask);
      const score = penalty(modules);
      if (!best || score < best.score) best = { modules, score, mask };
    }
    return { version, size: best.modules.length, mask: best.mask, modules: best.modules };
  }

  function toSvg(text, { quiet = 4, dark = '#1b1e18', light = '#fffefa' } = {}) {
    const { size, modules } = encode(text);
    const full = size + quiet * 2;
    let path = '';
    modules.forEach((row, y) => row.forEach((on, x) => { if (on) path += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${full}" height="${full}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
  }

  return Object.freeze({ encode, toSvg });
});
