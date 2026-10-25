import crypto from 'node:crypto';

/** No 0/O, 1/I/L or U, so a reference is easy to read over the phone. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Order reference such as "SP27-7KQ4MX". 30^6 = 729 million combinations, picked with a secure random generator. */
export function newReference(): string {
  let out = '';
  const bytes = crypto.randomBytes(12);
  for (let i = 0, n = 0; n < 6 && i < bytes.length; i++) {
    // reject values that would bias the result
    if (bytes[i] >= 240) continue;
    out += ALPHABET[bytes[i] % 30];
    n++;
  }
  return out.length === 6 ? `SP27-${out}` : newReference();
}

/** Accepts the reference typed by a customer in any case, with or without spaces or the dash. */
export function normaliseReference(input: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = s.startsWith('SP27') ? s.slice(4) : s;
  return /^[A-Z0-9]{6}$/.test(body) ? `SP27-${body}` : null;
}
