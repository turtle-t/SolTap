'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Telegram: any;
  }
}

interface Withdrawal {
  id: number;
  points_spent: number;
  wallet_address: string;
  status: string;
  requested_at: string;
  processed_at: string | null;
}

const MIN_WITHDRAWAL_POINTS = 10000;
const POINTS_PER_DOLLAR = 1000;

export default function WithdrawPage() {
  const [pointsBalance, setPointsBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  async function loadHistory() {
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) {
      setLoading(false);
      return;
    }

    const res = await fetch('/api/withdraw-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData }),
    });
    const data = await res.json();
    if (res.ok) {
      setPointsBalance(data.pointsBalance);
      setWithdrawals(data.withdrawals);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleSubmit() {
    setMessage(null);
    const tg = window.Telegram?.WebApp;

    if (!walletAddress.trim()) {
      setMessage('Please enter your Solana wallet address.');
      setMessageIsError(true);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData, walletAddress: walletAddress.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(data.message);
        setMessageIsError(false);
        setWalletAddress('');
        await loadHistory();
      } else {
        setMessage(data.error);
        setMessageIsError(true);
      }
    } catch (err) {
      setMessage('Something went wrong. Please try again.');
      setMessageIsError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main style={{ padding: '20px', textAlign: 'center' }}>Loading...</main>;
  }

  const canWithdraw = pointsBalance >= MIN_WITHDRAWAL_POINTS;
  const usdValue = (pointsBalance / POINTS_PER_DOLLAR).toFixed(2);

  return (
    <main style={{ padding: '20px', maxWidth: '480px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '22px' }}>Withdraw</h1>

      <div style={{
        background: 'linear-gradient(135deg, #1e2a3a, #14202e)',
        borderRadius: '16px',
        padding: '20px',
        color: '#fff',
        margin: '16px 0',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '13px', color: '#9fb3c8', margin: 0 }}>Available Balance</p>
        <p style={{ fontSize: '30px', fontWeight: 700, margin: '6px 0' }}>{pointsBalance} points</p>
        <p style={{ fontSize: '14px', color: '#9fb3c8', margin: 0 }}>≈ ${usdValue} in SOL</p>
      </div>

      {!canWithdraw && (
        <p style={{ color: '#e0a952', fontSize: '14px', textAlign: 'center' }}>
          You need at least {MIN_WITHDRAWAL_POINTS} points (${(MIN_WITHDRAWAL_POINTS / POINTS_PER_DOLLAR).toFixed(2)}) to withdraw.
        </p>
      )}

      {canWithdraw && (
        <div style={{ margin: '20px 0' }}>
          <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>
            Your Solana Wallet Address
          </label>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="Enter your Solana address"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              marginBottom: '12px',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: 700,
              background: submitting ? '#999' : '#2481cc',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              cursor: submitting ? 'default' : 'pointer',
            }}
          >
            {submitting ? 'Submitting...' : 'Request Withdrawal'}
          </button>
        </div>
      )}

      {message && (
        <p style={{ textAlign: 'center', color: messageIsError ? '#e05252' : '#3ecf8e', fontSize: '14px' }}>
          {message}
        </p>
      )}

      <h2 style={{ fontSize: '16px', marginTop: '28px' }}>Withdrawal History</h2>

      {withdrawals.length === 0 ? (
        <p style={{ color: '#999', fontSize: '14px' }}>No withdrawal requests yet.</p>
      ) : (
        <div>
          {withdrawals.map((w) => (
            <div key={w.id} style={{
              padding: '12px',
              borderBottom: '1px solid #2a3847',
              fontSize: '14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{w.points_spent} points</span>
                <span style={{
                  color:
                    w.status === 'sent' ? '#3ecf8e' :
                    w.status === 'rejected' ? '#e05252' :
                    w.status === 'approved' ? '#2481cc' : '#e0a952',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}>
                  {w.status}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                {new Date(w.requested_at).toLocaleDateString()} • {w.wallet_address.slice(0, 6)}...{w.wallet_address.slice(-6)}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}