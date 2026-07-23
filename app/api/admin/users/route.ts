import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = await sql`
    SELECT
      u.id, u.telegram_id, u.username, u.points_balance, u.flagged, u.flag_reason,
      u.created_at, u.last_ip,
      (SELECT COUNT(*) FROM ad_events ae WHERE ae.user_id = u.id AND ae.verified = TRUE) as verified_ad_count,
      (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id = u.id) as referral_count
    FROM users u
    ORDER BY u.flagged DESC, u.created_at DESC
    LIMIT 200
  `;

  return NextResponse.json({ users });
}