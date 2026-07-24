// ---------------------------------------------------------------------------
// Constellation drawing pool for the starfield background (§7 of the brief).
//
// A drawing is DATA, not code: a set of points in its own normalized box plus
// an ordered edge list. The starfield injects the points as ordinary stars
// (fully camouflaged, same sprites and twinkle rules), jitters them by the
// per-drawing `chaos`, and only the completed trace resolves the shape.
//
// Schema (one object per drawing):
//   id          kebab-case, unique
//   points      [[x, y], ...] normalized. Coordinates keep the figure's TRUE
//               aspect: the starfield reads the point bounding box and scales
//               the longest side to the target size, so a wide word or a tall
//               rocket is never squashed. y runs DOWN (canvas convention).
//   edges       [[i, j], ...] index pairs in tracing order. Non contiguous
//               pairs are fine (the pen lifts between them) so figures can
//               branch or come in separate strokes.
//   chaos       jitter amount, multiplied by ~14px at placement. Letters sit
//               a touch calmer so they still read once traced; figures wander
//               a little more. Omit to fall back to config.chaosDefault.
//   alwaysShow  true = placed on every load (the two brand letter groups).
//
// BSS and AUB are mandatory every load (§7). The rest of the pool is a
// starter set of simple single line figures; the user owes the FINAL figure
// list (§ open items), and swapping any of these is a one object edit here or
// a fresh export from the ?skyEditor=1 authoring tool.
// ---------------------------------------------------------------------------

// The two brand words. Authored letter by letter on a shared cap band
// (y 0.02 to 0.30) so the group reads wide, the way a real sky inscription
// would. Straight segments only, a couple of branches per B, exactly how a
// constellation map draws a glyph.
const BSS = {
  id: 'bss',
  alwaysShow: true,
  chaos: 0.3,
  points: [
    // B
    [0.06, 0.02], [0.06, 0.16], [0.06, 0.3], [0.25, 0.08], [0.26, 0.23],
    // S
    [0.6, 0.03], [0.4, 0.03], [0.4, 0.15], [0.6, 0.18], [0.59, 0.29], [0.4, 0.29],
    // S
    [0.94, 0.03], [0.74, 0.03], [0.74, 0.15], [0.94, 0.18], [0.93, 0.29], [0.74, 0.29],
  ],
  edges: [
    [0, 1], [1, 2], [0, 3], [3, 1], [1, 4], [4, 2], // B: spine + two lobes
    [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], // S
    [11, 12], [12, 13], [13, 14], [14, 15], [15, 16], // S
  ],
};

const AUB = {
  id: 'aub',
  alwaysShow: true,
  chaos: 0.3,
  points: [
    // A
    [0.04, 0.3], [0.11, 0.17], [0.16, 0.02], [0.21, 0.17], [0.28, 0.3],
    // U
    [0.39, 0.02], [0.39, 0.2], [0.5, 0.3], [0.61, 0.2], [0.61, 0.02],
    // B
    [0.74, 0.02], [0.74, 0.16], [0.74, 0.3], [0.93, 0.08], [0.94, 0.23],
  ],
  edges: [
    [0, 1], [1, 2], [2, 3], [3, 4], [1, 3], // A: legs + crossbar branch
    [5, 6], [6, 7], [7, 8], [8, 9], // U
    [10, 11], [11, 12], [10, 13], [13, 11], [11, 14], [14, 12], // B
  ],
};

// Figure pool (§7). Simple single line art; each resolves only once traced.
const FIGURES = [
  {
    id: 'paper-plane',
    chaos: 0.34,
    points: [[0.92, 0.12], [0.06, 0.3], [0.5, 0.52], [0.16, 0.82]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]],
  },
  {
    id: 'cedar-tree',
    chaos: 0.32,
    // three tiers of boughs over a short trunk, the way the cedar is drawn
    points: [
      [0.5, 0.06], [0.36, 0.34], [0.64, 0.34], // top tier
      [0.5, 0.24], [0.24, 0.6], [0.76, 0.6], // mid tier
      [0.5, 0.46], [0.14, 0.82], [0.86, 0.82], // low tier
      [0.5, 0.82], [0.5, 0.95], // trunk
    ],
    edges: [
      [0, 1], [1, 2], [2, 0],
      [3, 4], [4, 5], [5, 3],
      [6, 7], [7, 8], [8, 6],
      [9, 10],
    ],
  },
  {
    id: 'cat',
    chaos: 0.35,
    points: [
      [0.28, 0.1], [0.4, 0.24], [0.52, 0.1], // ears
      [0.58, 0.4], [0.52, 0.56], [0.28, 0.56], [0.22, 0.4], // head
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]],
  },
  {
    id: 'coffee-cup',
    chaos: 0.33,
    points: [
      [0.2, 0.24], [0.66, 0.24], [0.6, 0.8], [0.26, 0.8], // cup
      [0.66, 0.34], [0.84, 0.42], [0.84, 0.62], [0.64, 0.68], // handle
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7]],
  },
  {
    id: 'rocket',
    chaos: 0.33,
    points: [
      [0.5, 0.06], [0.66, 0.34], [0.66, 0.72], [0.84, 0.9],
      [0.62, 0.82], [0.38, 0.82], [0.16, 0.9], [0.34, 0.72], [0.34, 0.34],
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0]],
  },
  {
    id: 'crescent-moon',
    chaos: 0.34,
    points: [
      [0.62, 0.06], [0.34, 0.16], [0.2, 0.44], [0.3, 0.74], [0.6, 0.92], // outer
      [0.44, 0.72], [0.36, 0.46], [0.46, 0.24], // inner
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0]],
  },
  {
    id: 'sailboat',
    chaos: 0.33,
    points: [
      [0.14, 0.74], [0.86, 0.74], [0.72, 0.9], [0.28, 0.9], // hull
      [0.5, 0.74], [0.5, 0.12], [0.76, 0.66], // mast + sail
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 4]],
  },
  {
    id: 'key',
    chaos: 0.34,
    points: [
      [0.14, 0.34], [0.08, 0.5], [0.14, 0.66], [0.28, 0.66], [0.34, 0.5], [0.28, 0.34], // bow
      [0.86, 0.5], // shaft end
      [0.74, 0.5], [0.74, 0.64], // tooth
      [0.64, 0.5], [0.64, 0.62], // tooth
    ],
    edges: [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
      [4, 6], [7, 8], [9, 10],
    ],
  },
  {
    id: 'open-book',
    chaos: 0.32,
    points: [
      [0.5, 0.24], [0.5, 0.82], // spine
      [0.08, 0.32], [0.08, 0.8], // left page
      [0.92, 0.32], [0.92, 0.8], // right page
    ],
    edges: [[0, 2], [2, 3], [3, 1], [0, 4], [4, 5], [5, 1], [0, 1]],
  },
  {
    id: 'kite',
    chaos: 0.34,
    points: [
      [0.5, 0.06], [0.74, 0.4], [0.5, 0.72], [0.26, 0.4], // diamond
      [0.56, 0.86], [0.46, 0.96], // tail
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3], [2, 4], [4, 5]],
  },
  {
    id: 'shooting-star',
    chaos: 0.32,
    // one stroke pentagram
    points: [[0.5, 0.05], [0.68, 0.6], [0.2, 0.26], [0.8, 0.26], [0.32, 0.6]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]],
  },
  {
    id: 'house',
    chaos: 0.32,
    points: [
      [0.14, 0.44], [0.5, 0.12], [0.86, 0.44], // roof
      [0.78, 0.9], [0.22, 0.9], // walls
      [0.42, 0.9], [0.42, 0.66], [0.58, 0.66], [0.58, 0.9], // door
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [5, 6], [6, 7], [7, 8]],
  },
  {
    id: 'fish',
    chaos: 0.35,
    points: [
      [0.08, 0.5], [0.44, 0.24], [0.74, 0.5], [0.44, 0.76], // body
      [0.94, 0.32], [0.94, 0.68], // tail
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 5], [5, 2]],
  },
  {
    id: 'mountains',
    chaos: 0.33,
    points: [[0.04, 0.86], [0.28, 0.34], [0.44, 0.62], [0.62, 0.2], [0.82, 0.56], [0.96, 0.86]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  {
    id: 'envelope',
    chaos: 0.31,
    points: [[0.1, 0.28], [0.9, 0.28], [0.9, 0.76], [0.1, 0.76], [0.5, 0.56]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 1]],
  },
  {
    id: 'music-note',
    chaos: 0.34,
    points: [[0.3, 0.82], [0.44, 0.76], [0.44, 0.16], [0.66, 0.32]],
    edges: [[0, 1], [1, 2], [2, 3]],
  },
  {
    id: 'umbrella',
    chaos: 0.33,
    points: [
      [0.08, 0.48], [0.29, 0.3], [0.5, 0.22], [0.71, 0.3], [0.92, 0.48], // canopy
      [0.5, 0.86], [0.64, 0.92], // pole + hook
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [0, 4], [2, 5], [5, 6]],
  },
  {
    id: 'anchor',
    chaos: 0.34,
    points: [
      [0.5, 0.1], [0.5, 0.26], // ring + cross centre
      [0.32, 0.3], [0.68, 0.3], // crossbar
      [0.5, 0.8], // shaft base
      [0.22, 0.6], [0.33, 0.82], // left arm
      [0.78, 0.6], [0.67, 0.82], // right arm
    ],
    edges: [[0, 1], [2, 1], [1, 3], [1, 4], [4, 5], [5, 6], [4, 7], [7, 8]],
  },
];

// BSS + AUB first so callers can rely on the two brand words leading the pool.
export const DRAWINGS = [BSS, AUB, ...FIGURES];

export default DRAWINGS;
