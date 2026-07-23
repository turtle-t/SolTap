import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramInitData } from '@/lib/telegram';
import { sql } from '@/lib/db';

const POINTS_PER_AD = 1;
const MIN_AD_WATCH_SECONDS = 10;
const DAILY_BONUS_THRESHOLD = 50;
const DAILY_BONUS_POINTS = 100;
const STREAK_DAYS_REQUIRED = 7;
const STREAK_BONUS_POINTS = 1000;

export async function POST(req: NextRequest) {
  try {
    const { initData, adEventId } = await req.json();

    if (!initData || !adEventId) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

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

    const eventResult = await sql`
      SELECT id, user_id, claimed_at, points_awarded
      FROM ad_events
      WHERE id = ${adEventId} AND user_id = ${userId}
    `;

    if (eventResult.length === 0) {
      return NextResponse.json({ error: 'No matching ad session found' }, { status: 400 });
    }

    const event = eventResult[0];

    if (event.points_awarded) {
      return NextResponse.json({ error: 'This ad was already claimed' }, { status: 400 });
    }

    const secondsElapsed = (Date.now() - new Date(event.claimed_at).getTime()) / 1000;

    if (secondsElapsed < MIN_AD_WATCH_SECONDS) {
      return NextResponse.json(
        { error: 'Ad was not watched long enough.' },
        { status: 400 }
      );
    }

    // Mark ad event verified + credited
    await sql`
      UPDATE ad_events SET verified = TRUE, verified_at = NOW(), points_awarded = TRUE
      WHERE id = ${adEventId}
    `;

    // Base ad points
    await sql`
      INSERT INTO points_ledger (user_id, amount, source, reference_id)
      VALUES (${userId}, ${POINTS_PER_AD}, 'ad_view', ${adEventId})
    `;

    await sql`
      UPDATE users SET points_balance = points_balance + ${POINTS_PER_AD}
      WHERE id = ${userId}
    `;

    let totalAwarded = POINTS_PER_AD;
    let dailyBonusAwarded = false;
    let streakBonusAwarded = false;

    // Update today's activity count
    const dailyResult = await sql`
      INSERT INTO daily_activity (user_id, activity_date, verified_ad_count)
      VALUES (${userId}, CURRENT_DATE, 1)
      ON CONFLICT (user_id, activity_date)
      DO UPDATE SET verified_ad_count = daily_activity.verified_ad_count + 1
      RETURNING verified_ad_count, daily_bonus_paid
    `;

    const todayCount = dailyResult[0].verified_ad_count;
    const alreadyPaidToday = dailyResult[0].daily_bonus_paid;

    // --- Daily bonus check ---
    if (todayCount >= DAILY_BONUS_THRESHOLD && !alreadyPaidToday) {
      await sql`
        UPDATE daily_activity SET daily_bonus_paid = TRUE
        WHERE user_id = ${userId} AND activity_date = CURRENT_DATE
      `;

      await sql`
        INSERT INTO points_ledger (user_id, amount, source, reference_id)
        VALUES (${userId}, ${DAILY_BONUS_POINTS}, 'daily_bonus', ${adEventId})
      `;

      await sql`
        UPDATE users SET points_balance = points_balance + ${DAILY_BONUS_POINTS}
        WHERE id = ${userId}
      `;

      totalAwarded += DAILY_BONUS_POINTS;
      dailyBonusAwarded = true;

      // --- Streak update (only advances once per day, exactly when daily bonus triggers) ---
      const streakResult = await sql`
        SELECT current_streak_days, last_qualifying_date FROM streaks
        WHERE user_id = ${userId}
      `;

      let newStreakDays = 1;

      if (streakResult.length > 0) {
        const lastDate = streakResult[0].last_qualifying_date;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const lastDateStr = lastDate ? new Date(lastDate).toISOString().split('T')[0] : null;

        if (lastDateStr === yesterdayStr) {
          // Continued the streak
          newStreakDays = streakResult[0].current_streak_days + 1;
        } else {
          // Streak broken (or first time) — restart at 1
          newStreakDays = 1;
        }

        await sql`
          UPDATE streaks
          SET current_streak_days = ${newStreakDays}, last_qualifying_date = CURRENT_DATE, updated_at = NOW()
          WHERE user_id = ${userId}
        `;
      } else {
        await sql`
          INSERT INTO streaks (user_id, current_streak_days, last_qualifying_date)
          VALUES (${userId}, 1, CURRENT_DATE)
        `;
      }

      // --- Streak bonus check ---
      if (newStreakDays >= STREAK_DAYS_REQUIRED) {
        await sql`
          INSERT INTO points_ledger (user_id, amount, source, reference_id)
          VALUES (${userId}, ${STREAK_BONUS_POINTS}, 'streak_bonus', ${adEventId})
        `;

        await sql`
          UPDATE users SET points_balance = points_balance + ${STREAK_BONUS_POINTS}
          WHERE id = ${userId}
        `;

        // Reset streak counter after paying out, so the next 7-day cycle starts fresh
        await sql`
          UPDATE streaks SET current_streak_days = 0
          WHERE user_id = ${userId}
        `;

        totalAwarded += STREAK_BONUS_POINTS;
        streakBonusAwarded = true;
      }
    }

    let message = `+${POINTS_PER_AD} point credited`;
    if (dailyBonusAwarded) message += ` (+${DAILY_BONUS_POINTS} daily bonus!)`;
    if (streakBonusAwarded) message += ` (+${STREAK_BONUS_POINTS} 7-day streak bonus!)`;

    return NextResponse.json({
      success: true,
      message,
      totalAwarded,
      dailyBonusAwarded,
      streakBonusAwarded,
    });

  } catch (error) {
    console.error('Claim reward error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}