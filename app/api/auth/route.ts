import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramInitData } from '@/lib/telegram';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();

    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
    }

    const verified = verifyTelegramInitData(initData);

    if (!verified) {
      return NextResponse.json({ error: 'Invalid Telegram data' }, { status: 401 });
    }

    const { user } = verified;

    // Check if this user already exists
    const existing = await sql`
      SELECT id, telegram_id, username, points_balance, solana_address
      FROM users
      WHERE telegram_id = ${user.id}
    `;

    if (existing.length > 0) {
      // Existing user — just return their data
      return NextResponse.json({ user: existing[0] });
    }

    // New user — create a row
    const created = await sql`
      INSERT INTO users (telegram_id, username)
      VALUES (${user.id}, ${user.username || user.first_name})
      RETURNING id, telegram_id, username, points_balance, solana_address
    `;

    return NextResponse.json({ user: created[0] });

  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}