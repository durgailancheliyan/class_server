import crypto from 'crypto';

export function generateSessionSlug() {
  return crypto.randomBytes(8).toString('hex');
}
