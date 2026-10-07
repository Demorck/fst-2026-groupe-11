import { randomInt } from 'node:crypto';

// No 0/O/1/I/L: the code is read aloud and typed by hand at check-in
export const TICKET_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TICKET_CODE_LENGTH = 8;

export function generateTicketCode() {
  return Array.from(
    { length: TICKET_CODE_LENGTH },
    () => TICKET_CODE_ALPHABET[randomInt(TICKET_CODE_ALPHABET.length)],
  ).join('');
}
