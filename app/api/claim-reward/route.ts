import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramInitData } from '@/lib/telegram';
import { sql } from '@/lib/db';

const POINTS_PER_AD = 1;
const MIN_AD_WATCH_SECONDS = 10;
const DAILY_BONUS_THRESHOLD = 50;
const DAILY_BONUS_POINTS = 100;
const STREAK_DAYS_REQUIRED = 7;
const STREAK_BONUS_POINTS = 1000;

const REFERRAL_SIGNUP_BONUS = 100;
const REFERRAL_MILESTONE_REVENUE_USD = 10;
const REFERRAL_MILESTONE_BONUS = 1000;
const REFERRAL_COMMISSION_PERCENT = 2;
const CREDITING_RATE_POINTS_PER_DOLLAR = 100; // matches our "$1 = 100 points" display rate

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

    await sql`
      UPDATE ad_events SET verified = TRUE, verified_at = NOW(), points_awarded = TRUE
      WHERE id = ${adEventId}
    `;

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

    // --- Daily activity + streak (unchanged from before) ---
    const dailyResult = await sql`
      INSERT INTO daily_activity (user_id, activity_date, verified_ad_count)
      VALUES (${userId}, CURRENT_DATE, 1)
      ON CONFLICT (user_id, activity_date)
      DO UPDATE SET verified_ad_count = daily_activity.verified_ad_count + 1
      RETURNING verified_ad_count, daily_bonus_paid
    `;

    const todayCount = dailyResult[0].verified_ad_count;
    const alreadyPaidToday = dailyResult[0].daily_bonus_paid;

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

      const streakResult = await sql`
        SELECT current_streak_days, last_qualifying_date FROM streaks WHERE user_id = ${userId}
      `;
      let newStreakDays = 1;

      if (streakResult.length > 0) {
        const lastDate = streakResult[0].last_qualifying_date;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const lastDateStr = lastDate ? new Date(lastDate).toISOString().split('T')[0] : null;

        newStreakDays = lastDateStr === yesterdayStr ? streakResult[0].current_streak_days + 1 : 1;

        await sql`
          UPDATE streaks SET current_streak_days = ${newStreakDays}, last_qualifying_date = CURRENT_DATE, updated_at = NOW()
          WHERE user_id = ${userId}
        `;
      } else {
        await sql`
          INSERT INTO streaks (user_id, current_streak_days, last_qualifying_date)
          VALUES (${userId}, 1, CURRENT_DATE)
        `;
      }

      if (newStreakDays >= STREAK_DAYS_REQUIRED) {
        await sql`
          INSERT INTO points_ledger (user_id, amount, source, reference_id)
          VALUES (${userId}, ${STREAK_BONUS_POINTS}, 'streak_bonus', ${adEventId})
        `;
        await sql`
          UPDATE users SET points_balance = points_balance + ${STREAK_BONUS_POINTS}
          WHERE id = ${userId}
        `;
        await sql`
          UPDATE streaks SET current_streak_days = 0 WHERE user_id = ${userId}
        `;
        totalAwarded += STREAK_BONUS_POINTS;
        streakBonusAwarded = true;
      }
    }

    // --- Referral logic ---
    // Check if this user (B) was referred by someone (A)
    const referralResult = await sql`
      SELECT id, referrer_id, first_ad_verified, milestone_paid, total_referred_revenue
      FROM referrals
      WHERE referred_id = ${userId}
    `;

    if (referralResult.length > 0) {
      const referral = referralResult[0];
      const referrerId = referral.referrer_id;

      // This ad view's revenue-equivalent in dollars, based on our crediting rate
      const thisViewRevenueUsd = POINTS_PER_AD / CREDITING_RATE_POINTS_PER_DOLLAR;
      const newTotalRevenue = Number(referral.total_referred_revenue) + thisViewRevenueUsd;

      await sql`
        UPDATE referrals SET total_referred_revenue = ${newTotalRevenue}
        WHERE id = ${referral.id}
      `;

      // 1. Signup bonus — fires once, on B's FIRST verified ad
      if (!referral.first_ad_verified) {
        await sql`
          UPDATE referrals SET first_ad_verified = TRUE WHERE id = ${referral.id}
        `;

        // Bonus to referrer (A)
        await sql`
          INSERT INTO points_ledger (user_id, amount, source, reference_id)
          VALUES (${referrerId}, ${REFERRAL_SIGNUP_BONUS}, 'referral_signup_bonus', ${referral.id})
        `;
        await sql`
          UPDATE users SET points_balance = points_balance + ${REFERRAL_SIGNUP_BONUS}
          WHERE id = ${referrerId}
        `;

        // Bonus to referred user (B) — this user, right now
        await sql`
          INSERT INTO points_ledger (user_id, amount, source, reference_id)
          VALUES (${userId}, ${REFERRAL_SIGNUP_BONUS}, 'referral_signup_bonus', ${referral.id})
        `;
        await sql`
          UPDATE users SET points_balance = points_balance + ${REFERRAL_SIGNUP_BONUS}
          WHERE id = ${userId}
        `;

        totalAwarded += REFERRAL_SIGNUP_BONUS;
      }

      // 2. Milestone bonus — fires once, when referred user's total revenue hits $10
      if (!referral.milestone_paid && newTotalRevenue >= REFERRAL_MILESTONE_REVENUE_USD) {
        await sql`
          UPDATE referrals SET milestone_paid = TRUE WHERE id = ${referral.id}
        `;

        await sql`
          INSERT INTO points_ledger (user_id, amount, source, reference_id)
          VALUES (${referrerId}, ${REFERRAL_MILESTONE_BONUS}, 'referral_milestone_bonus', ${referral.id})
        `;
        await sql`
          UPDATE users SET points_balance = points_balance + ${REFERRAL_MILESTONE_BONUS}
          WHERE id = ${referrerId}
        `;
      }

      // 3. Lifetime commission — 2% of every point B earns, credited to A, every time
      const commissionPoints = Math.floor((totalAwarded * REFERRAL_COMMISSION_PERCENT) / 100);
      if (commissionPoints > 0) {
        await sql`
          INSERT INTO points_ledger (user_id, amount, source, reference_id)
          VALUES (${referrerId}, ${commissionPoints}, 'referral_commission', ${adEventId})
        `;
        await sql`
          UPDATE users SET points_balance = points_balance + ${commissionPoints}
          WHERE id = ${referrerId}
        `;
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