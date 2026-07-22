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

    const { user } = verified;

    // Capture requester IP from headers (Vercel sets these)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // Check if this user already exists
    const existing = await sql`
      SELECT id, telegram_id, username, points_balance, solana_address
      FROM users
      WHERE telegram_id = ${user.id}
    `;

    let userRow;

    if (existing.length > 0) {
      // Existing user — update their IP/fingerprint on each visit
      const updated = await sql`
        UPDATE users
        SET last_ip = ${ip}, fingerprint_hash = ${fingerprint || null}
        WHERE telegram_id = ${user.id}
        RETURNING id, telegram_id, username, points_balance, solana_address
      `;
      userRow = updated[0];
    } else {
      // New user — create with IP/fingerprint captured immediately
      const created = await sql`
        INSERT INTO users (telegram_id, username, last_ip, fingerprint_hash)
        VALUES (${user.id}, ${user.username || user.first_name}, ${ip}, ${fingerprint || null})
        RETURNING id, telegram_id, username, points_balance, solana_address
      `;
      userRow = created[0];
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
        // Flag this user, log why, but don't block anything
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

    return NextResponse.json({ user: userRow });

  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}