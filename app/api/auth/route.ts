import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramInitData } from '@/lib/telegram';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { initData, fingerprint } = await req.json();

    if (!initData) {
      return NextResponse.json({ error: 'Missing initData' }, { status: 400 });
    }

    const verified = verifyTelegramInitData(initData);

    if (!verified) {
      return NextResponse.json({ error: 'Invalid Telegram data' }, { status: 401 });
    }

    const { user, startParam } = verified;

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const existing = await sql`
      SELECT id, telegram_id, username, points_balance, solana_address
      FROM users
      WHERE telegram_id = ${user.id}
    `;

    let userRow;
    let isNewUser = false;

    if (existing.length > 0) {
      const updated = await sql`
        UPDATE users
        SET last_ip = ${ip}, fingerprint_hash = ${fingerprint || null}
        WHERE telegram_id = ${user.id}
        RETURNING id, telegram_id, username, points_balance, solana_address
      `;
      userRow = updated[0];
    } else {
      const created = await sql`
        INSERT INTO users (telegram_id, username, last_ip, fingerprint_hash)
        VALUES (${user.id}, ${user.username || user.first_name}, ${ip}, ${fingerprint || null})
        RETURNING id, telegram_id, username, points_balance, solana_address
      `;
      userRow = created[0];
      isNewUser = true;
    }

    // --- Referral capture (only matters for genuinely new users) ---
    if (isNewUser && startParam && startParam.startsWith('ref_')) {
      const referrerTelegramId = startParam.replace('ref_', '');

      const referrer = await sql`
        SELECT id FROM users WHERE telegram_id = ${referrerTelegramId}
      `;

      if (referrer.length > 0 && referrer[0].id !== userRow.id) {
        await sql`
          INSERT INTO referrals (referrer_id, referred_id)
          VALUES (${referrer[0].id}, ${userRow.id})
          ON CONFLICT (referred_id) DO NOTHING
        `;
      }
    }

    // --- Fraud check: shared IP or fingerprint across other accounts ---
    if (fingerprint || ip !== 'unknown') {
      const sharedAccounts = await sql`
        SELECT id FROM users
        WHERE id != ${userRow.id}
        AND (
          (fingerprint_hash = ${fingerprint} AND fingerprint_hash IS NOT NULL)
          OR (last_ip = ${ip} AND last_ip != 'unknown')
        )
      `;

      const SHARED_ACCOUNT_THRESHOLD = 3;

      if (sharedAccounts.length >= SHARED_ACCOUNT_THRESHOLD) {
        await sql`
          UPDATE users
          SET flagged = TRUE, flag_reason = 'Shared IP/fingerprint with multiple other accounts'
          WHERE id = ${userRow.id}
        `;

        await sql`
          INSERT INTO fraud_flags (user_id, flag_type, detail)
          VALUES (${userRow.id}, 'shared_fingerprint', ${`Matched ${sharedAccounts.length} other accounts on IP/fingerprint`})
        `;
      }
    }

    // --- Streak + today's ad count, for the home screen ---
    const streakResult = await sql`
      SELECT current_streak_days FROM streaks WHERE user_id = ${userRow.id}
    `;
    const todayResult = await sql`
      SELECT verified_ad_count FROM daily_activity
      WHERE user_id = ${userRow.id} AND activity_date = CURRENT_DATE
    `;

    return NextResponse.json({
      user: userRow,
      streakDays: streakResult[0]?.current_streak_days || 0,
      todayAdCount: todayResult[0]?.verified_ad_count || 0,
    });

  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}