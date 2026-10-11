/** Date and time as the forms keep them: `YYYY-MM-DDTHH:mm` in local time, `''` when empty. */
export interface Parts {
  y: number;
  /** 1 to 12 */
  m: number;
  d: number;
  h: number;
  min: number;
}

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

/** True when the parts are a real date (no 31 February, no 25:00). */
function isReal({ y, m, d, h, min }: Parts) {
  const date = new Date(y, m - 1, d, h, min);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d &&
    date.getHours() === h &&
    date.getMinutes() === min
  );
}

export function parseValue(value: string): Parts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [y, m, d, h, min] = match.slice(1).map(Number);
  const parts = { y, m, d, h, min };
  return isReal(parts) ? parts : null;
}

export const toValue = ({ y, m, d, h, min }: Parts) =>
  `${pad(y, 4)}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}`;

/** `20/11/2026 20:00` */
export function formatDisplay(value: string) {
  const parts = parseValue(value);
  if (!parts) return '';
  return `${pad(parts.d)}/${pad(parts.m)}/${pad(parts.y, 4)} ${pad(parts.h)}:${pad(parts.min)}`;
}

/** What a person types (`20/11/2026 20:00`, `1/2/2026 9:30`), or a pasted `YYYY-MM-DDTHH:mm`; null when incomplete or not a date. */
export function parseDisplay(text: string): string | null {
  const typed =
    /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*$/.exec(text);
  if (!typed) return parseValue(text.trim()) ? text.trim() : null;
  const [d, m, y, h, min] = typed.slice(1).map(Number);
  const parts = { y, m, d, h, min };
  return isReal(parts) ? toValue(parts) : null;
}

export const dayKey = (y: number, m: number, d: number) =>
  `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

/** The 6 weeks (Monday first) that cover a month, as `YYYY-MM-DD` keys. */
export function monthGrid(y: number, m: number) {
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(y, m - 1, 1 - offset + i);
    return {
      key: dayKey(date.getFullYear(), date.getMonth() + 1, date.getDate()),
      day: date.getDate(),
      inMonth: date.getMonth() === m - 1,
    };
  });
}

/** Times of the day by quarter hour: `00:00` to `23:45`. */
export const TIMES = Array.from(
  { length: 96 },
  (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`,
);
