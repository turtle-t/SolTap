import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramInitData } from '@/lib/telegram';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();
    const verified = verifyTelegramInitData(initData);
    if (!verified) {
      return NextResponse.json({ error: 'Invalid Telegram data' }, { status: 401 });
    }

    const userResult = await sql`
      SELECT id FROM users WHERE telegram_id = ${verified.user.id}
    `;
    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userResult[0].id;

    // Log a pending ad event with the real server-side start time
    const event = await sql`
      INSERT INTO ad_events (user_id, ad_type, verified, points_awarded)
      VALUES (${userId}, 'rewarded_interstitial', FALSE, FALSE)
      RETURNING id, claimed_at
    `;

    return NextResponse.json({ adEventId: event[0].id });

  } catch (error) {
    console.error('Ad start error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}