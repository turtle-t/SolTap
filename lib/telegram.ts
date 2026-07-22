import crypto from 'crypto';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface VerifiedInitData {
  user: TelegramUser;
  authDate: number;
}

/**
 * Verifies that initData genuinely came from Telegram and hasn't been tampered with.
 * Telegram signs initData using an HMAC-SHA256 hash, computed with a secret key
 * derived from your bot token. We recompute that same hash here — if it matches
 * the hash Telegram sent, the data is authentic.
 *
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramInitData(initData: string): VerifiedInitData | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  // Remove hash from the params before recomputing — it's not part of the signed payload
  params.delete('hash');

  // Build the "data check string" — all remaining fields, sorted alphabetically,
  // joined as key=value pairs separated by newlines
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Secret key = HMAC-SHA256 of the bot token, using "WebAppData" as the key
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // Compute the expected hash
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) {
    return null; // Signature mismatch — this did NOT genuinely come from Telegram
  }

  // Check auth_date isn't too old (prevents replay attacks with stale data)
  const authDate = Number(params.get('auth_date'));
  const now = Math.floor(Date.now() / 1000);
  const maxAge = 86400; // 24 hours
  if (now - authDate > maxAge) {
    return null; // Too old, reject
  }

  const userJson = params.get('user');
  if (!userJson) return null;

  const user: TelegramUser = JSON.parse(userJson);

  return { user, authDate };
}