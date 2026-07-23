import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramInitData } from '@/lib/telegram';
import { sql } from '@/lib/db';

const POINTS_PER_AD = 1;
const MIN_AD_WATCH_SECONDS = 10; // must match roughly the real ad duration
const MIN_SECONDS_BETWEEN_CLAIMS = 15;

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

    // Fetch the ad_start event, confirm it belongs to this user and isn't already claimed
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

    // The critical check: real server-side elapsed time since ad started
    const secondsElapsed = (Date.now() - new Date(event.claimed_at).getTime()) / 1000;

    if (secondsElapsed < MIN_AD_WATCH_SECONDS) {
      return NextResponse.json(
        { error: 'Ad was not watched long enough.' },
        { status: 400 }
      );
    }

    // Mark this event as verified + credited
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

    await sql`
      INSERT INTO daily_activity (user_id, activity_date, verified_ad_count)
      VALUES (${userId}, CURRENT_DATE, 1)
      ON CONFLICT (user_id, activity_date)
      DO UPDATE SET verified_ad_count = daily_activity.verified_ad_count + 1
    `;

    return NextResponse.json({
      success: true,
      message: `+${POINTS_PER_AD} point credited`,
    });

  } catch (error) {
    console.error('Claim reward error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}