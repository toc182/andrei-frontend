// Depth padding for the Descripción cell, shared by the read row and the
// editor row so both indent a subtree identically — literal Tailwind classes
// (no dynamic `pl-${n}` strings, which Tailwind cannot see), clamped for
// depths beyond the scale.

const PAD = ['pl-0', 'pl-4', 'pl-8', 'pl-12', 'pl-16', 'pl-20', 'pl-24', 'pl-28', 'pl-32'];

export const padClass = (depth: number) => PAD[Math.min(depth, PAD.length - 1)];

// Nested-group blue band, darkest at level 0 and lighter as it nests (tokens in
// index.css, both themes). Clamped past the ramp. See FRONTEND_CONVENTIONS.md §22.
const GRUPO_BG = ['bg-grupo-0', 'bg-grupo-1', 'bg-grupo-2', 'bg-grupo-3'];

export const grupoBgClass = (depth: number) => GRUPO_BG[Math.min(depth, GRUPO_BG.length - 1)];
