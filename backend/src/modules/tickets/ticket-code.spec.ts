import {
  generateTicketCode,
  TICKET_CODE_ALPHABET,
  TICKET_CODE_LENGTH,
} from './ticket-code.js';

describe('generateTicketCode', () => {
  it('returns a short code made only of unambiguous characters', () => {
    const code = generateTicketCode();

    expect(code).toHaveLength(TICKET_CODE_LENGTH);
    expect(code).toMatch(new RegExp(`^[${TICKET_CODE_ALPHABET}]+$`));
    expect(code).not.toMatch(/[01OIL]/);
  });

  it('does not repeat over many draws', () => {
    const codes = new Set(Array.from({ length: 1000 }, generateTicketCode));

    expect(codes.size).toBe(1000);
  });
});
