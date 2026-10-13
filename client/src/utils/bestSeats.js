/**
 * Find the best `count` seats next to each other.
 *
 * "Best" means:
 *  - all seats in one row, numbered one after another, in the same section;
 *  - as close to the middle of the row as possible (straight-on view);
 *  - in the best row for the event type: about two-thirds back for films (whole screen
 *    in view), as close to the front as possible for concerts.
 *
 * Returns candidate blocks, best first, so a caller can fall back to the next block
 * if someone grabs a seat in the first one at the same moment.
 */
export function findBestSeats(seats, count, { section = null, eventType = 'concert', limit = 5 } = {}) {
  if (!count || count < 1) return [];

  const byRow = new Map();
  seats.forEach((s) => {
    if (!byRow.has(s.row)) byRow.set(s.row, []);
    byRow.get(s.row).push(s);
  });
  const rows = [...byRow.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const lastRow = Math.max(rows.length - 1, 1);
  const idealRow = eventType === 'movie' ? Math.round(lastRow * 0.62) : 0;

  const candidates = [];
  rows.forEach((row, rowIndex) => {
    const rowSeats = byRow.get(row).slice().sort((a, b) => a.number - b.number);
    const first = rowSeats[0].number;
    const last = rowSeats[rowSeats.length - 1].number;
    const rowCentre = (first + last) / 2;
    const halfWidth = Math.max((last - first) / 2, 1);

    for (let i = 0; i + count <= rowSeats.length; i += 1) {
      const block = rowSeats.slice(i, i + count);
      const free = block.every((s) => s.status === 'available');
      const together = block.every((s, k) => k === 0 || s.number === block[k - 1].number + 1);
      const sameSection = block.every((s) => s.section === block[0].section);
      const inSection = !section || block[0].section === section;
      if (!(free && together && sameSection && inSection)) continue;

      const blockCentre = (block[0].number + block[block.length - 1].number) / 2;
      const sideways = Math.abs(blockCentre - rowCentre) / halfWidth; // 0 = dead centre
      const depth = Math.abs(rowIndex - idealRow) / lastRow; // 0 = best row
      candidates.push({ seats: block, score: sideways * 1.0 + depth * 1.3 });
    }
  });

  return candidates
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((c) => c.seats);
}
