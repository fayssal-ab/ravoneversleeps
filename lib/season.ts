/** Holiday decorations (snow, hat, New Year chip) run from 1 Nov to 10 Jan. */
export function isHolidaySeason(d = new Date()): boolean {
  const m = d.getUTCMonth();
  return m === 10 || m === 11 || (m === 0 && d.getUTCDate() <= 10);
}

/** The New Year the countdown points at (next 1 January). */
export function nextNewYear(d = new Date()): number {
  return d.getUTCMonth() === 0 ? d.getUTCFullYear() : d.getUTCFullYear() + 1;
}
