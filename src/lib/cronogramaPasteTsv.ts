// Tab-separated parser for the cronograma bulk-paste dialog. Excel/Sheets put TAB between cells
// and LF/CRLF between rows when you copy a range; a single cell that itself contains a tab or
// newline is wrapped in double quotes (RFC 4180). This is a four-state machine — NOT split() —
// because split() can't tell a structural tab/newline from one living inside a quoted cell.
//
// Pinned quoting rules (match Excel's clipboard behavior, verified in the build spec):
//   - A `"` is structural ONLY as the first character of a cell. Anywhere else it is literal,
//     so `3" pipe` stays `3" pipe` (a mid-cell quote does not start quoting).
//   - Inside a quoted cell, `""` is one literal quote; a lone `"` closes the cell. Any text that
//     somehow follows the closing quote before the delimiter is appended literally (lenient — we
//     never drop characters).
//   - A quoted cell may contain literal tabs and newlines; they are content, not separators.
//
// Pipeline: normalize CRLF/CR -> LF and strip invisible artifacts, tokenize, drop one trailing
// all-empty row, then pad every row to the max column count so callers can index by column.

// Invisible characters that must never affect parsing: ZWSP/ZWNJ/ZWJ/BOM are dropped and NBSP
// becomes a normal space. Done with numeric code points so the source stays free of invisibles.
const STRIP_CODES = new Set([0x200b, 0x200c, 0x200d, 0xfeff]);

/** Normalize line endings, drop zero-width characters, and turn NBSP into a normal space. */
function normalize(text: string): string {
  let out = '';
  for (const ch of text.replace(/\r\n?/g, '\n')) {
    const c = ch.codePointAt(0);
    if (c === 0x00a0) out += ' ';
    else if (c !== undefined && STRIP_CODES.has(c)) continue;
    else out += ch;
  }
  return out;
}

type State = 'fieldStart' | 'unquoted' | 'quoted' | 'quoteInQuoted';

/**
 * Parse tab-separated clipboard text into a rectangular grid of cells.
 * Rows are padded to the widest row; a single trailing all-empty row (from a final newline or a
 * row of bare tabs) is dropped. Returns `[]` for empty/blank input.
 */
export function parseTsv(text: string): string[][] {
  const src = normalize(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let state: State = 'fieldStart';

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
    state = 'fieldStart';
  };

  for (const ch of src) {
    switch (state) {
      case 'fieldStart':
        if (ch === '"') state = 'quoted';
        else if (ch === '\t') endCell(); // empty cell, next cell still starts fresh
        else if (ch === '\n') endRow();
        else {
          cell += ch;
          state = 'unquoted';
        }
        break;
      case 'unquoted':
        if (ch === '\t') {
          endCell();
          state = 'fieldStart';
        } else if (ch === '\n') {
          endRow();
        } else {
          cell += ch; // a `"` here is literal (mid-cell quote)
        }
        break;
      case 'quoted':
        if (ch === '"') state = 'quoteInQuoted';
        else cell += ch; // literal tab / newline allowed inside a quoted cell
        break;
      case 'quoteInQuoted':
        if (ch === '"') {
          cell += '"'; // escaped quote
          state = 'quoted';
        } else if (ch === '\t') {
          endCell();
          state = 'fieldStart';
        } else if (ch === '\n') {
          endRow();
        } else {
          cell += ch; // lone quote closed the cell; trailing text appended literally
          state = 'unquoted';
        }
        break;
    }
  }
  // Flush the final cell/row unless the text ended exactly on a row boundary.
  if (state !== 'fieldStart' || cell !== '' || row.length > 0) {
    endCell();
    rows.push(row);
  }

  // Drop a single trailing all-empty row (final newline, or a row of only tabs).
  if (rows.length && rows[rows.length - 1].every((c) => c.trim() === '')) {
    rows.pop();
  }

  // Pad ragged rows to the widest row so callers can index columns safely.
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  for (const r of rows) while (r.length < maxCols) r.push('');

  return rows;
}
