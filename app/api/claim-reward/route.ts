import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramInitData } from '@/lib/telegram';
import { sql } from '@/lib/db';

const POINTS_PER_AD = 1; // matches config.points_per_ad — we'll make this dynamic later
const MIN_SECONDS_BETWEEN_CLAIMS = 15; // a real rewarded interstitial takes at least this long

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

    const telegramId = verified.user.id;

    const userResult = await sql`
      SELECT id FROM users WHERE telegram_id = ${telegramId}
    `;

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = userResult[0].id;

    // Rate limit: check the most recent ad_event for this user
    const lastEvent = await sql`
      SELECT claimed_at FROM ad_events
      WHERE user_id = ${userId}
      ORDER BY claimed_at DESC
      LIMIT 1
    `;

    if (lastEvent.length > 0) {
      const secondsSinceLast =
        (Date.now() - new Date(lastEvent[0].claimed_at).getTime()) / 1000;

      if (secondsSinceLast < MIN_SECONDS_BETWEEN_CLAIMS) {
        return NextResponse.json(
          { error: 'Please wait before claiming another reward.' },
          { status: 429 }
        );
      }
    }

    // Log the ad event (marked unverified — no postback available yet)
    const adEvent = await sql`
      INSERT INTO ad_events (user_id, ad_type, verified, points_awarded)
      VALUES (${userId}, 'rewarded_interstitial', FALSE, TRUE)
      RETURNING id
    `;
    const adEventId = adEvent[0].id;

    // Credit points — ledger entry + balance update, together
    await sql`
      INSERT INTO points_ledger (user_id, amount, source, reference_id)
      VALUES (${userId}, ${POINTS_PER_AD}, 'ad_view', ${adEventId})
    `;

    await sql`
      UPDATE users SET points_balance = points_balance + ${POINTS_PER_AD}
      WHERE id = ${userId}
    `;

    // Update daily activity count toward the 50/day bonus
    await sql`
      INSERT INTO daily_activity (user_id, activity_date, verified_ad_count)
      VALUES (${userId}, CURRENT_DATE, 1)
      ON CONFLICT (user_id, activity_date)
      DO UPDATE SET verified_ad_count = daily_activity.verified_ad_count + 1
    `;

    return NextResponse.json({
      success: true,
      message: `+${POINTS_PER_AD} point credited`,
      pointsAwarded: POINTS_PER_AD,
    });

  } catch (error) {
    console.error('Claim reward error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}