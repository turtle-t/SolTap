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
      SELECT id, telegram_id FROM users WHERE telegram_id = ${verified.user.id}
    `;
    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const userId = userResult[0].id;
    const telegramId = userResult[0].telegram_id;

    // All referrals made by this user
    const referrals = await sql`
      SELECT r.id, u.username, r.first_ad_verified, r.milestone_paid, r.total_referred_revenue, r.created_at
      FROM referrals r
      JOIN users u ON u.id = r.referred_id
      WHERE r.referrer_id = ${userId}
      ORDER BY r.created_at DESC
    `;

    // Total points earned specifically from referral sources
    const earningsResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM points_ledger
      WHERE user_id = ${userId}
      AND source IN ('referral_signup_bonus', 'referral_milestone_bonus', 'referral_commission')
    `;

    return NextResponse.json({
      telegramId,
      referredCount: referrals.length,
      totalReferralEarnings: Number(earningsResult[0].total),
      referrals: referrals.map(r => ({
        username: r.username,
        firstAdVerified: r.first_ad_verified,
        milestonePaid: r.milestone_paid,
        totalRevenue: Number(r.total_referred_revenue),
        joinedAt: r.created_at,
      })),
    });

  } catch (error) {
    console.error('Referral stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}