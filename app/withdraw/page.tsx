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
    if (!tg?.initData) { setLoading(false); return; }

    const res = await fetch('/api/withdraw-history', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData }),
    });
    const data = await res.json();
    if (res.ok) {
      setPointsBalance(data.pointsBalance);
      setWithdrawals(data.withdrawals);
    }
    setLoading(false);
  }

  useEffect(() => { loadHistory(); }, []);

  async function handleSubmit() {
    setMessage(null);
    const tg = window.Telegram?.WebApp;

    if (!walletAddress.trim()) {
      setMessage('ENTER YOUR SOLANA ADDRESS');
      setMessageIsError(true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData, walletAddress: walletAddress.trim() }),
      });
      const data = await res.json();

      if (res.ok) {
        const usd = (pointsBalance / POINTS_PER_DOLLAR).toFixed(3);
        setMessage(`CASH OUT REQUESTED: $${usd}`);
        setMessageIsError(false);
        setWalletAddress('');
        await loadHistory();
      } else {
        setMessage(data.error?.toUpperCase() || 'SOMETHING WENT WRONG');
        setMessageIsError(true);
      }
    } catch (err) {
      setMessage('SOMETHING WENT WRONG');
      setMessageIsError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main style={styles.centerScreen}>LOADING...</main>;

  const canWithdraw = pointsBalance >= MIN_WITHDRAWAL_POINTS;
  const usdValue = (pointsBalance / POINTS_PER_DOLLAR).toFixed(3);
  const minUsd = (MIN_WITHDRAWAL_POINTS / POINTS_PER_DOLLAR).toFixed(2);
  const progressPct = Math.min((pointsBalance / MIN_WITHDRAWAL_POINTS) * 100, 100);

  return (
    <main style={styles.page}>
      <p className="pixel-font" style={styles.eyebrow}>PAYDAY</p>
      <h1 className="pixel-font" style={styles.heading}>CASH OUT</h1>

      <div style={styles.balanceCard}>
        <p className="pixel-font" style={styles.balanceLabel}>AVAILABLE</p>
        <p className="pixel-font" style={styles.balanceValue}>${usdValue}</p>

        {!canWithdraw && (
          <>
            <div style={styles.barTrack}>
              <div style={{ ...styles.barFill, width: `${progressPct}%` }} />
            </div>
            <p className="pixel-font" style={styles.barLabel}>
              NEED ${minUsd} TO CASH OUT
            </p>
          </>
        )}
      </div>

      {canWithdraw && (
        <div style={styles.formCard}>
          <label className="pixel-font" style={styles.inputLabel}>SOLANA WALLET ADDRESS</label>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="Enter your address"
            style={styles.input}
          />
          <button
            className="pixel-font"
            onClick={handleSubmit}
            disabled={submitting}
            style={{ ...styles.submitBtn, opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? 'SENDING...' : 'CASH OUT'}
          </button>
        </div>
      )}

      {message && (
        <p className="pixel-font" style={{ textAlign: 'center', fontSize: '10px', color: messageIsError ? 'var(--danger)' : 'var(--coin-teal)', margin: '16px 0' }}>
          {message}
        </p>
      )}

      <h2 className="pixel-font" style={styles.subheading}>HISTORY</h2>

      {withdrawals.length === 0 ? (
        <p style={styles.emptyText}>No cash-outs yet.</p>
      ) : (
        <div>
          {withdrawals.map((w) => (
            <div key={w.id} style={styles.historyRow}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="pixel-font" style={{ fontSize: '11px' }}>${(w.points_spent / POINTS_PER_DOLLAR).toFixed(3)}</span>
                <span className="pixel-font" style={{
                  fontSize: '9px',
                  color:
                    w.status === 'sent' ? 'var(--coin-teal)' :
                    w.status === 'rejected' ? 'var(--danger)' :
                    w.status === 'approved' ? 'var(--coin-gold)' : 'var(--text-muted)',
                }}>
                  {w.status.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {new Date(w.requested_at).toLocaleDateString()} • {w.wallet_address.slice(0, 6)}...{w.wallet_address.slice(-6)}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '24px 20px', maxWidth: '480px', margin: '0 auto', textAlign: 'center', paddingBottom: '40px' },
  centerScreen: { padding: '20px', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Press Start 2P', monospace", fontSize: '12px' },
  eyebrow: { fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '6px' },
  heading: { fontSize: '16px', margin: '0 0 20px' },
  balanceCard: {
    background: 'var(--surface)', border: '4px solid var(--border)', borderRadius: '4px',
    padding: '22px', marginBottom: '18px', boxShadow: '5px 5px 0 rgba(0,0,0,0.4)',
  },
  balanceLabel: { fontSize: '9px', color: 'var(--text-muted)', margin: 0 },
  balanceValue: { fontSize: '26px', color: 'var(--coin-gold)', margin: '8px 0' },
  barTrack: { width: '100%', height: '14px', background: '#0f0e1a', border: '2px solid var(--border)', borderRadius: '3px', overflow: 'hidden', marginTop: '10px' },
  barFill: { height: '100%', background: 'var(--coin-gold)', transition: 'width 0.3s ease' },
  barLabel: { fontSize: '8px', color: 'var(--text-muted)', marginTop: '8px' },
  formCard: {
    background: 'var(--surface)', border: '4px solid var(--border)', borderRadius: '4px',
    padding: '16px', marginBottom: '10px', boxShadow: '5px 5px 0 rgba(0,0,0,0.4)', textAlign: 'left',
  },
  inputLabel: { fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' },
  input: {
    width: '100%', padding: '12px', fontSize: '14px', borderRadius: '3px',
    border: '2px solid var(--border)', background: '#0f0e1a', color: 'var(--text)',
    marginBottom: '12px', boxSizing: 'border-box', fontFamily: "'VT323', monospace",
  },
  submitBtn: {
    width: '100%', padding: '14px', fontSize: '12px', background: 'var(--coin-gold)',
    color: '#1a1408', border: '3px solid #a8791e', borderRadius: '3px', cursor: 'pointer',
    boxShadow: '4px 4px 0 rgba(0,0,0,0.4)',
  },
  subheading: { fontSize: '12px', textAlign: 'left', margin: '20px 0 10px' },
  emptyText: { color: 'var(--text-muted)', fontSize: '14px', textAlign: 'left' },
  historyRow: { padding: '10px', borderBottom: '2px solid var(--border)', textAlign: 'left' },
};