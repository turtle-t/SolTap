import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramInitData } from '@/lib/telegram';
import { sql } from '@/lib/db';

const DAILY_BONUS_THRESHOLD = 50;
const DAILY_BONUS_POINTS = 100;
const STREAK_DAYS_REQUIRED = 7;
const STREAK_BONUS_POINTS = 1000;
const POINTS_PER_DOLLAR = 1000;

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

    const todayResult = await sql`
      SELECT verified_ad_count, daily_bonus_paid FROM daily_activity
      WHERE user_id = ${userId} AND activity_date = CURRENT_DATE
    `;
    const streakResult = await sql`
      SELECT current_streak_days FROM streaks WHERE user_id = ${userId}
    `;

    const todayCount = todayResult[0]?.verified_ad_count || 0;
    const dailyBonusPaid = todayResult[0]?.daily_bonus_paid || false;
    const streakDays = streakResult[0]?.current_streak_days || 0;

    return NextResponse.json({
      daily: {
        current: todayCount,
        target: DAILY_BONUS_THRESHOLD,
        rewardUsd: DAILY_BONUS_POINTS / POINTS_PER_DOLLAR,
        completed: dailyBonusPaid,
      },
      streak: {
        current: streakDays,
        target: STREAK_DAYS_REQUIRED,
        rewardUsd: STREAK_BONUS_POINTS / POINTS_PER_DOLLAR,
      },
    });

  } catch (error) {
    console.error('Tasks status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}