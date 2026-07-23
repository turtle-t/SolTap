import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramInitData } from '@/lib/telegram';
import { sql } from '@/lib/db';

const MIN_WITHDRAWAL_POINTS = 10000;
const POINTS_PER_DOLLAR = 1000; // 1000 points = $1, matches 5000 pts = $5

// Very basic Solana address format check (base58, roughly 32-44 chars)
function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export async function POST(req: NextRequest) {
  try {
    const { initData, walletAddress } = await req.json();

    if (!initData || !walletAddress) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    if (!isValidSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: 'Invalid Solana wallet address' }, { status: 400 });
    }

    const verified = verifyTelegramInitData(initData);
    if (!verified) {
      return NextResponse.json({ error: 'Invalid Telegram data' }, { status: 401 });
    }

    const userResult = await sql`
      SELECT id, points_balance, flagged FROM users WHERE telegram_id = ${verified.user.id}
    `;
    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userResult[0];

    // Check if user has a pending withdrawal already — block a second one
    const pendingCheck = await sql`
      SELECT id FROM withdrawals WHERE user_id = ${user.id} AND status = 'pending'
    `;
    if (pendingCheck.length > 0) {
      return NextResponse.json(
        { error: 'You already have a pending withdrawal request.' },
        { status: 400 }
      );
    }

    if (user.points_balance < MIN_WITHDRAWAL_POINTS) {
      return NextResponse.json(
        { error: `Minimum withdrawal is ${MIN_WITHDRAWAL_POINTS} points.` },
        { status: 400 }
      );
    }

    const pointsToWithdraw = user.points_balance; // withdraw full balance for simplicity in v1
    const usdValue = pointsToWithdraw / POINTS_PER_DOLLAR;

    // Deduct points immediately (refunded automatically if rejected later)
    await sql`
      UPDATE users SET points_balance = points_balance - ${pointsToWithdraw}
      WHERE id = ${user.id}
    `;

    const withdrawal = await sql`
      INSERT INTO withdrawals (user_id, points_spent, wallet_address, status)
      VALUES (${user.id}, ${pointsToWithdraw}, ${walletAddress}, 'pending')
      RETURNING id
    `;

    await sql`
      INSERT INTO points_ledger (user_id, amount, source, reference_id)
      VALUES (${user.id}, ${-pointsToWithdraw}, 'withdrawal', ${withdrawal[0].id})
    `;

    return NextResponse.json({
      success: true,
      message: `Withdrawal request submitted for ${pointsToWithdraw} points (~$${usdValue.toFixed(2)}).`,
      withdrawalId: withdrawal[0].id,
    });

  } catch (error) {
    console.error('Withdraw error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}