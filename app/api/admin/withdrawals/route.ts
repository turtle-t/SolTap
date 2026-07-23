import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const withdrawals = await sql`
    SELECT w.id, w.user_id, u.username, u.telegram_id, u.flagged,
           w.points_spent, w.wallet_address, w.status, w.requested_at, w.processed_at
    FROM withdrawals w
    JOIN users u ON u.id = w.user_id
    ORDER BY
      CASE w.status WHEN 'pending' THEN 0 ELSE 1 END,
      w.requested_at DESC
  `;

  return NextResponse.json({ withdrawals });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { withdrawalId, action } = await req.json(); // action: 'approve' | 'reject'

    const withdrawalResult = await sql`
      SELECT id, user_id, points_spent, status FROM withdrawals WHERE id = ${withdrawalId}
    `;

    if (withdrawalResult.length === 0) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
    }

    const withdrawal = withdrawalResult[0];

    if (withdrawal.status !== 'pending') {
      return NextResponse.json({ error: 'This withdrawal is already processed' }, { status: 400 });
    }

    if (action === 'approve') {
      await sql`
        UPDATE withdrawals SET status = 'sent', processed_at = NOW()
        WHERE id = ${withdrawalId}
      `;
      // Note: actual SOL transfer happens manually by you outside this system for now
    } else if (action === 'reject') {
      await sql`
        UPDATE withdrawals SET status = 'rejected', processed_at = NOW()
        WHERE id = ${withdrawalId}
      `;

      // Refund points back to the user
      await sql`
        UPDATE users SET points_balance = points_balance + ${withdrawal.points_spent}
        WHERE id = ${withdrawal.user_id}
      `;

      await sql`
        INSERT INTO points_ledger (user_id, amount, source, reference_id)
        VALUES (${withdrawal.user_id}, ${withdrawal.points_spent}, 'withdrawal_refund', ${withdrawalId})
      `;
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Admin withdrawal action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}