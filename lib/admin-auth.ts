import { NextRequest } from 'next/server';
import crypto from 'crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'change-this-secret';

export function checkAdminPassword(password: string): boolean {
  if (!ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD is not set');
  return password === ADMIN_PASSWORD;
}

export function generateSessionToken(): string {
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(timestamp)
    .digest('hex');
  return `${timestamp}.${signature}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;

  const [timestamp, signature] = token.split('.');
  if (!timestamp || !signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(timestamp)
    .digest('hex');

  if (signature !== expectedSignature) return false;

  // Session valid for 24 hours
  const age = Date.now() - Number(timestamp);
  if (age > 24 * 60 * 60 * 1000) return false;

  return true;
}

export function isAdminAuthenticated(req: NextRequest): boolean {
  const token = req.cookies.get('admin_session')?.value;
  return verifySessionToken(token);
}