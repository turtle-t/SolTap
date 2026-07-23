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
      SELECT id, points_balance FROM users WHERE telegram_id = ${verified.user.id}
    `;
    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = userResult[0].id;

    const withdrawals = await sql`
      SELECT id, points_spent, wallet_address, status, requested_at, processed_at
      FROM withdrawals
      WHERE user_id = ${userId}
      ORDER BY requested_at DESC
    `;

    return NextResponse.json({
      pointsBalance: userResult[0].points_balance,
      withdrawals,
    });

  } catch (error) {
    console.error('Withdraw history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}