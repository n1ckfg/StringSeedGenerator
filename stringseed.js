/**
 * StringSeed — JavaScript implementation of the SSoT (String Seed of Thought) protocol.
 *
 * Based on Misaki & Akiba (2025), "String Seed of Thought: Prompting LLMs for
 * Distribution-Faithful and Diverse Generation", arxiv 2510.21150.
 *
 * The protocol:
 *   1. Generate a real hex seed from cryptographic randomness.
 *   2. Enumerate axes — each axis lists 2+ concrete candidates.
 *   3. Map seed to indices — take non-overlapping 4-char hex slices,
 *      convert to int, apply modulo N.
 *   4. Write a provenance block with verifiable arithmetic.
 *
 * Usage:
 *   const ss = new StringSeed();
 *   ss.addAxis('shape', ['circle', 'square', 'triangle']);
 *   ss.addAxis('color', ['red', 'blue', 'green', 'yellow']);
 *
 *   const seed = StringSeed.generateSeed(8);   // 16 hex chars
 *   const results = ss.resolve(seed);
 *   console.log(StringSeed.provenance(seed, results));
 *
 * @version 1.0.0
 * @license MIT
 */
class StringSeed {

  constructor() {
    /** @type {Array<{ name: string, candidates: Array<*> }>} */
    this.axes = [];
  }

  // ---------------------------------------------------------------------------
  // Seed generation
  // ---------------------------------------------------------------------------

  /**
   * Generate a cryptographically random hex seed.
   *
   * Uses `crypto.getRandomValues` (browser / Node 19+). Each byte yields
   * two hex characters, matching the `openssl rand -hex N` convention.
   *
   * @param {number} [numBytes=8] — Number of random bytes (output length = numBytes × 2).
   * @returns {string} Lower-case hex string.
   */
  static generateSeed(numBytes = 8) {
    const bytes = new Uint8Array(numBytes);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  // ---------------------------------------------------------------------------
  // Axis management
  // ---------------------------------------------------------------------------

  /**
   * Register a named axis with its candidate list.
   *
   * Candidates can be any type — strings, numbers, objects, etc.
   * Order matters: index 0 is the first candidate.
   *
   * @param {string} name — Human-readable axis name (e.g. "shape type").
   * @param {Array<*>} candidates — At least 2 concrete, distinguishable options.
   * @returns {StringSeed} this (for chaining).
   * @throws {Error} If fewer than 2 candidates are supplied.
   */
  addAxis(name, candidates) {
    if (!Array.isArray(candidates) || candidates.length < 2) {
      throw new Error(`Axis "${name}" must have at least 2 candidates.`);
    }
    this.axes.push({ name, candidates: [...candidates] });
    return this;
  }

  /**
   * Remove all registered axes.
   * @returns {StringSeed} this.
   */
  clearAxes() {
    this.axes = [];
    return this;
  }

  /**
   * Minimum hex-string length needed for non-overlapping 4-char slices
   * across all currently registered axes.
   * @returns {number} Hex characters required.
   */
  requiredSeedLength() {
    return this.axes.length * 4;
  }

  /**
   * Minimum byte count for `generateSeed()` to cover all axes without wrapping.
   * @returns {number} Bytes.
   */
  requiredSeedBytes() {
    return Math.ceil(this.requiredSeedLength() / 2);
  }

  // ---------------------------------------------------------------------------
  // Slice extraction & mapping
  // ---------------------------------------------------------------------------

  /**
   * Extract a 4-character hex slice for the given axis index.
   *
   * Uses non-overlapping slices (axis 0 → chars 0-3, axis 1 → chars 4-7, …).
   * If the seed is shorter than needed the slice wraps modulo seed length,
   * which introduces correlation — prefer a seed of `requiredSeedLength()`.
   *
   * @param {string} seed — Hex string.
   * @param {number} axisIndex — 0-based axis position.
   * @returns {string} 4-character hex slice (lower-case).
   */
  static getSlice(seed, axisIndex) {
    const SLICE_LEN = 4;
    const start = (axisIndex * SLICE_LEN) % seed.length;
    let slice = '';
    for (let i = 0; i < SLICE_LEN; i++) {
      slice += seed[(start + i) % seed.length];
    }
    return slice.toLowerCase();
  }

  /**
   * Convert a hex slice to a candidate index via integer conversion + modulo.
   *
   * @param {string} hexSlice — 4-char hex string.
   * @param {number} n — Number of candidates on this axis.
   * @returns {{ intValue: number, index: number }}
   */
  static mapToIndex(hexSlice, n) {
    const intValue = parseInt(hexSlice, 16);
    if (isNaN(intValue) || n < 1) {
      return { intValue: 0, index: 0 };
    }
    return { intValue, index: intValue % n };
  }

  // ---------------------------------------------------------------------------
  // Resolution
  // ---------------------------------------------------------------------------

  /**
   * Resolve the seed against all registered axes.
   *
   * For every axis, this method:
   *   1. Extracts a non-overlapping 4-char hex slice.
   *   2. Converts the slice to an integer.
   *   3. Applies `int % candidateCount` to select a candidate.
   *
   * @param {string} seed — Hex string (non-hex characters are stripped).
   * @returns {Array<{
   *   axis: string,
   *   hexSlice: string,
   *   intValue: number,
   *   n: number,
   *   index: number,
   *   choice: *
   * }>} One entry per axis, fully traceable.
   */
  resolve(seed) {
    const clean = seed.replace(/[^0-9a-fA-F]/g, '').toLowerCase();

    if (clean.length === 0) {
      // Degenerate case: every axis falls back to candidate 0.
      return this.axes.map(a => ({
        axis:     a.name,
        hexSlice: '0000',
        intValue: 0,
        n:        a.candidates.length,
        index:    0,
        choice:   a.candidates[0],
      }));
    }

    return this.axes.map((axis, i) => {
      const hexSlice = StringSeed.getSlice(clean, i);
      const { intValue, index } = StringSeed.mapToIndex(hexSlice, axis.candidates.length);
      return {
        axis:     axis.name,
        hexSlice,
        intValue,
        n:        axis.candidates.length,
        index,
        choice:   axis.candidates[index],
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Provenance
  // ---------------------------------------------------------------------------

  /**
   * Render a verifiable SSoT provenance block.
   *
   * A reviewer can verify any line with:
   *   `python3 -c 'print(int("<hexSlice>", 16) % <n>)'`
   *
   * @param {string} seed — Original hex seed.
   * @param {Array} results — Output of `resolve()`.
   * @param {object} [meta] — Optional `{ piece, version, date }`.
   * @returns {string} Multi-line provenance block.
   */
  static provenance(seed, results, meta = {}) {
    const parts = [meta.piece, meta.version, meta.date].filter(Boolean);
    const header = parts.length
      ? `SSoT provenance -- ${parts.join(', ')}`
      : 'SSoT provenance';

    let block = `${header}\n  seed: ${seed}\n`;

    results.forEach((r, i) => {
      const choiceStr = (typeof r.choice === 'object' && r.choice !== null)
        ? JSON.stringify(r.choice)
        : String(r.choice);
      block += `  axis ${i + 1} (${r.axis}, n=${r.n}): `
            +  `int(${r.hexSlice},16)=${r.intValue}, `
            +  `${r.intValue} % ${r.n} = ${r.index} -> ${choiceStr}\n`;
    });

    return block;
  }

  /**
   * Render a grouped provenance block — useful when axes are logically
   * organised in repeating groups (e.g. per-shape properties).
   *
   * @param {string} seed — Hex seed.
   * @param {Array} results — Output of `resolve()`.
   * @param {number} groupSize — Axes per group.
   * @param {Function} [groupLabel] — `(groupIndex) => string`.  Default: `"Group N"`.
   * @param {object} [meta] — Optional `{ piece, version, date }`.
   * @returns {string}
   */
  static groupedProvenance(seed, results, groupSize, groupLabel, meta = {}) {
    const parts = [meta.piece, meta.version, meta.date].filter(Boolean);
    const header = parts.length
      ? `SSoT provenance -- ${parts.join(', ')}`
      : 'SSoT provenance';

    const labelFn = groupLabel || ((g) => `Group ${g + 1}`);

    let block = `${header}\n  seed: ${seed}\n`;

    for (let g = 0; g * groupSize < results.length; g++) {
      block += `\n  ${labelFn(g)}:\n`;
      const start = g * groupSize;
      const end = Math.min(start + groupSize, results.length);
      for (let i = start; i < end; i++) {
        const r = results[i];
        const choiceStr = (typeof r.choice === 'object' && r.choice !== null)
          ? JSON.stringify(r.choice)
          : String(r.choice);
        block += `    axis ${i + 1} (${r.axis}, n=${r.n}): `
              +  `int(${r.hexSlice},16)=${r.intValue}, `
              +  `${r.intValue} % ${r.n} = ${r.index} -> ${choiceStr}\n`;
      }
    }

    return block;
  }
}

// ---------------------------------------------------------------------------
// Module export (CommonJS / ES-module-in-bundler fallback)
// ---------------------------------------------------------------------------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StringSeed;
}
