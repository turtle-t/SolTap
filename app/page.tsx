'use client';

import { useEffect, useState } from 'react';
import { generateFingerprint } from '@/lib/fingerprint';

interface User {
  id: number;
  telegram_id: number;
  username: string;
  points_balance: number;
  solana_address: string | null;
}

declare global {
  interface Window {
    Telegram: any;
    show_11374343: (options?: any) => Promise<void>;
  }
}

type FlowState = 'idle' | 'instructions' | 'watching' | 'verifying' | 'result';

const POINTS_PER_DOLLAR = 1000;
const DAILY_BONUS_THRESHOLD = 50;

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [streakDays, setStreakDays] = useState(0);
  const [todayAdCount, setTodayAdCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [balancePop, setBalancePop] = useState(false);

  async function syncFromAuth(animate = false) {
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) return;
    const fingerprint = generateFingerprint();
    const res = await fetch('/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, fingerprint }),
    });
    const data = await res.json();
    if (res.ok) {
      setUser(data.user);
      setStreakDays(data.streakDays || 0);
      setTodayAdCount(data.todayAdCount || 0);
      if (animate) { setBalancePop(true); setTimeout(() => setBalancePop(false), 700); }
    }
    return data;
  }

  useEffect(() => {
    async function authenticate() {
      try {
        const tg = window.Telegram?.WebApp;
        if (!tg) { setError('This app must be opened inside Telegram.'); setLoading(false); return; }
        tg.ready();
        if (!tg.initData) { setError('No Telegram data found. Open this app via your Telegram bot.'); setLoading(false); return; }

        const data = await syncFromAuth(false);
        if (!data) setError('Authentication failed');
      } catch (err) {
        setError('Something went wrong connecting to the server.');
      } finally {
        setLoading(false);
      }
    }
    authenticate();
  }, []);

  function startFlow() { setResultMessage(null); setFlowState('instructions'); }

  async function beginWatchingAd() {
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) { setResultMessage('Telegram session not found.'); setResultSuccess(false); setFlowState('result'); return; }

    setFlowState('watching');
    try {
      const startRes = await fetch('/api/ad-start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) { setResultMessage(startData.error || 'Could not start ad session.'); setResultSuccess(false); setFlowState('result'); return; }

      await window.show_11374343();
      setFlowState('verifying');

      const res = await fetch('/api/claim-reward', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData, adEventId: startData.adEventId }),
      });
      const data = await res.json();

      if (res.ok) {
        const dollarsEarned = (data.totalAwarded / POINTS_PER_DOLLAR).toFixed(3);
        setResultMessage(`+$${dollarsEarned} EARNED!`);
        setResultSuccess(true);
        await syncFromAuth(true);
      } else {
        setResultMessage(data.error || 'Could not claim reward.');
        setResultSuccess(false);
      }
    } catch (err) {
      setResultMessage('Ad was not completed.');
      setResultSuccess(false);
    } finally {
      setFlowState('result');
    }
  }

  function closeOverlay() { setFlowState('idle'); }

  if (loading) return <main style={styles.centerScreen}>LOADING...</main>;
  if (error) return <main style={{ ...styles.centerScreen, color: 'var(--danger)' }}>{error}</main>;

  const usdValue = user ? (user.points_balance / POINTS_PER_DOLLAR).toFixed(3) : '0.000';
  const filledBlocks = Math.round((todayAdCount / DAILY_BONUS_THRESHOLD) * 10);

  return (
    <main style={styles.page}>
      <p className="pixel-font" style={styles.eyebrow}>PLAYER</p>
      <h1 className="pixel-font" style={styles.heading}>{user?.username}</h1>

      {/* Streak */}
      <div style={styles.streakRow}>
        <span className="flame-flicker" style={{ fontSize: '22px' }}>🔥</span>
        <span className="pixel-font" style={styles.streakText}>{streakDays} DAY STREAK</span>
      </div>

      {/* Coin balance */}
      <div style={styles.coinBox}>
        <p className="pixel-font" style={styles.coinLabel}>BALANCE</p>
        <p className={`pixel-font ${balancePop ? 'balance-pop' : ''}`} style={styles.coinValue}>
          ${usdValue}
        </p>
      </div>

      {/* Daily progress — segmented pixel blocks */}
      <p className="pixel-font" style={styles.progressLabel}>
        {todayAdCount}/{DAILY_BONUS_THRESHOLD} ADS — BONUS AT {DAILY_BONUS_THRESHOLD}
      </p>
      <div style={styles.blockRow}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{
            ...styles.block,
            background: i < filledBlocks ? 'var(--coin-gold)' : 'var(--surface)',
            borderColor: i < filledBlocks ? 'var(--coin-gold)' : 'var(--border)',
          }} />
        ))}
      </div>

      <button className="pixel-font" style={styles.watchButton} onClick={startFlow}>
        ▶ WATCH AD
      </button>

      <div className="pixel-font" style={styles.bannerSlot}>AD SPACE</div>

      {flowState !== 'idle' && (
        <div style={styles.overlayBackdrop}>
          <div style={styles.overlayCard}>
            {flowState === 'instructions' && (
              <>
                <h2 className="pixel-font" style={styles.overlayTitle}>BEFORE YOU START</h2>
                <ul style={styles.instructionList}>
                  <li>Tap START AD below.</li>
                  <li>Wait for the ad's timer to finish — don't close early.</li>
                  <li>After the timer ends, tap Continue inside the ad.</li>
                  <li>You'll return here automatically.</li>
                  <li>Closing early = no reward.</li>
                </ul>
                <button className="pixel-font" style={styles.primaryButton} onClick={beginWatchingAd}>START AD</button>
                <button className="pixel-font" style={styles.secondaryButton} onClick={closeOverlay}>CANCEL</button>
              </>
            )}
            {flowState === 'watching' && (
              <>
                <div style={styles.spinner} />
                <p style={styles.overlayText}>Loading your ad…</p>
                <p style={styles.overlaySubtext}>Wait for it to finish before tapping Continue.</p>
              </>
            )}
            {flowState === 'verifying' && (
              <>
                <div style={styles.spinner} />
                <p style={styles.overlayText}>Verifying…</p>
              </>
            )}
            {flowState === 'result' && (
              <>
                <p className="pixel-font" style={{ ...styles.overlayText, color: resultSuccess ? 'var(--coin-gold)' : 'var(--danger)', fontSize: '15px' }}>
                  {resultMessage}
                </p>
                <button className="pixel-font" style={styles.primaryButton} onClick={closeOverlay}>OK</button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '24px 20px', maxWidth: '480px', margin: '0 auto', textAlign: 'center' },
  centerScreen: { padding: '20px', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Press Start 2P', monospace", fontSize: '12px' },
  eyebrow: { fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '6px' },
  heading: { fontSize: '16px', margin: '0 0 16px' },
  streakRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '20px' },
  streakText: { fontSize: '10px', color: 'var(--coin-gold)' },
  coinBox: {
    background: 'var(--surface)', border: '4px solid var(--border)', borderRadius: '4px',
    padding: '24px', marginBottom: '18px', boxShadow: '6px 6px 0 rgba(0,0,0,0.4)',
  },
  coinLabel: { fontSize: '9px', color: 'var(--text-muted)', marginBottom: '10px' },
  coinValue: { fontSize: '32px', color: 'var(--coin-gold)', margin: 0, display: 'inline-block' },
  progressLabel: { fontSize: '9px', color: 'var(--text-muted)', marginBottom: '8px' },
  blockRow: { display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '24px' },
  block: { width: '20px', height: '20px', border: '2px solid', borderRadius: '2px' },
  watchButton: {
    width: '100%', padding: '18px', fontSize: '13px',
    background: 'var(--coin-gold)', color: '#1a1408', border: '4px solid #a8791e',
    borderRadius: '4px', cursor: 'pointer', boxShadow: '5px 5px 0 rgba(0,0,0,0.4)',
  },
  bannerSlot: { marginTop: '20px', color: 'var(--text-muted)', fontSize: '9px', padding: '16px', border: '3px dashed var(--border)', borderRadius: '4px' },
  overlayBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  overlayCard: { background: 'var(--surface)', border: '4px solid var(--border)', borderRadius: '4px', padding: '26px 22px', maxWidth: '380px', width: '100%', textAlign: 'center', boxShadow: '6px 6px 0 rgba(0,0,0,0.4)' },
  overlayTitle: { fontSize: '13px', marginBottom: '16px' },
  instructionList: { textAlign: 'left', fontSize: '16px', lineHeight: 1.7, color: 'var(--text-muted)', marginBottom: '20px', paddingLeft: '20px' },
  overlayText: { fontSize: '17px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' },
  overlaySubtext: { fontSize: '14px', color: 'var(--text-muted)' },
  primaryButton: { width: '100%', padding: '14px', fontSize: '12px', background: 'var(--coin-gold)', color: '#1a1408', border: '3px solid #a8791e', borderRadius: '4px', cursor: 'pointer', marginTop: '8px', boxShadow: '4px 4px 0 rgba(0,0,0,0.4)' },
  secondaryButton: { width: '100%', padding: '12px', fontSize: '11px', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', marginTop: '6px' },
  spinner: { width: '32px', height: '32px', border: '4px solid var(--coin-gold)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' },
};