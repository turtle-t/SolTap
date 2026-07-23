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
  startParam: string | null;
}

export function verifyTelegramInitData(initData: string): VerifiedInitData | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) {
    return null;
  }

  const authDate = Number(params.get('auth_date'));
  const now = Math.floor(Date.now() / 1000);
  const maxAge = 86400;
  if (now - authDate > maxAge) {
    return null;
  }

  const userJson = params.get('user');
  if (!userJson) return null;

  const user: TelegramUser = JSON.parse(userJson);
  const startParam = params.get('start_param');

  return { user, authDate, startParam };
}