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
const DAILY_BONUS_THRESHOLD = 50; // ads

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultSuccess, setResultSuccess] = useState(false);
  const [balancePop, setBalancePop] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    async function authenticate() {
      try {
        const tg = window.Telegram?.WebApp;
        if (!tg) { setError('This app must be opened inside Telegram.'); setLoading(false); return; }

        tg.ready();
        const initData = tg.initData;
        if (!initData) { setError('No Telegram data found. Open this app via your Telegram bot.'); setLoading(false); return; }

        const fingerprint = generateFingerprint();
        const res = await fetch('/api/auth', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData, fingerprint }),
        });
        const data = await res.json();
        if (!res.ok) setError(data.error || 'Authentication failed');
        else setUser(data.user);
      } catch (err) {
        setError('Something went wrong connecting to the server.');
      } finally {
        setLoading(false);
      }
    }
    authenticate();
  }, []);

  async function refreshBalance(animate = false) {
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
      if (animate) { setBalancePop(true); setTimeout(() => setBalancePop(false), 450); }
    }
  }

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
        setResultMessage(`+$${dollarsEarned} earned!`);
        setResultSuccess(true);
        setTodayCount((c) => Math.min(c + 1, DAILY_BONUS_THRESHOLD));
        await refreshBalance(true);
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

  if (loading) return <main style={styles.centerScreen}>Loading...</main>;
  if (error) return <main style={{ ...styles.centerScreen, color: 'var(--danger)' }}>{error}</main>;

  const usdValue = user ? (user.points_balance / POINTS_PER_DOLLAR).toFixed(3) : '0.000';
  const progressPct = Math.min((todayCount / DAILY_BONUS_THRESHOLD) * 100, 100);
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (progressPct / 100) * circumference;

  return (
    <main style={styles.page}>
      <h1 className="font-display" style={styles.heading}>Hey, {user?.username}</h1>
      <p style={styles.subheading}>Watch ads, earn real Solana</p>

      <div style={styles.balanceWrap}>
        <svg width="140" height="140" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
          <circle cx="70" cy="70" r="54" stroke="var(--border)" strokeWidth="6" fill="none" />
          <circle
            cx="70" cy="70" r="54" stroke="url(#ringGradient)" strokeWidth="6" fill="none"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
          <defs>
            <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="var(--accent-purple)" /><stop offset="1" stopColor="var(--accent-teal)" />
            </linearGradient>
          </defs>
        </svg>
        <div style={styles.balanceCircleInner}>
          <p style={{ ...styles.balanceLabel }}>Balance</p>
          <p className={`font-mono ${balancePop ? 'balance-pop' : ''}`} style={styles.balanceValue}>
            ${usdValue}
          </p>
        </div>
      </div>

      <p style={styles.progressCaption}>
        {todayCount}/{DAILY_BONUS_THRESHOLD} ads today · bonus at {DAILY_BONUS_THRESHOLD}
      </p>

      <button style={styles.watchButton} onClick={startFlow}>
        Watch Ad to Earn
      </button>

      <div style={styles.bannerSlot}>Ad space</div>

      {flowState !== 'idle' && (
        <div style={styles.overlayBackdrop}>
          <div style={styles.overlayCard}>
            {flowState === 'instructions' && (
              <>
                <h2 className="font-display" style={styles.overlayTitle}>Before you start</h2>
                <ul style={styles.instructionList}>
                  <li>Tap <strong>Start Ad</strong> below.</li>
                  <li>Wait for the ad's timer to finish completely — don't close it early.</li>
                  <li>After the timer ends, tap <strong>Continue</strong> inside the ad.</li>
                  <li>You'll return here automatically — stay on this screen.</li>
                  <li>Closing early means <strong>no reward</strong>.</li>
                </ul>
                <button style={styles.primaryButton} onClick={beginWatchingAd}>Start Ad</button>
                <button style={styles.secondaryButton} onClick={closeOverlay}>Cancel</button>
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
                <p style={styles.overlaySubtext}>Just a moment.</p>
              </>
            )}
            {flowState === 'result' && (
              <>
                <p style={{ ...styles.overlayText, color: resultSuccess ? 'var(--accent-teal)' : 'var(--danger)', fontSize: '20px' }}>
                  {resultMessage}
                </p>
                <button style={styles.primaryButton} onClick={closeOverlay}>Done</button>
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
  centerScreen: { padding: '20px', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: '24px', margin: '8px 0 2px', fontWeight: 700 },
  subheading: { fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 28px' },
  balanceWrap: { position: 'relative', width: '140px', height: '140px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  balanceCircleInner: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  balanceLabel: { fontSize: '11px', color: 'var(--text-muted)', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' },
  balanceValue: { fontSize: '26px', fontWeight: 700, margin: '4px 0 0', color: 'var(--text)' },
  progressCaption: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '14px', marginBottom: '28px' },
  watchButton: {
    width: '100%', padding: '17px', fontSize: '16px', fontWeight: 700,
    background: 'var(--gradient)', color: '#0d0b16', border: 'none', borderRadius: '14px', cursor: 'pointer',
    fontFamily: 'Sora, sans-serif',
  },
  bannerSlot: { marginTop: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '14px', border: '1px dashed var(--border)', borderRadius: '10px' },
  overlayBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  overlayCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '18px', padding: '28px 24px', maxWidth: '380px', width: '100%', textAlign: 'center' },
  overlayTitle: { fontSize: '19px', marginBottom: '16px' },
  instructionList: { textAlign: 'left', fontSize: '14px', lineHeight: 1.7, color: 'var(--text-muted)', marginBottom: '20px', paddingLeft: '20px' },
  overlayText: { fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' },
  overlaySubtext: { fontSize: '13px', color: 'var(--text-muted)' },
  primaryButton: { width: '100%', padding: '14px', fontSize: '15px', fontWeight: 700, background: 'var(--gradient)', color: '#0d0b16', border: 'none', borderRadius: '12px', cursor: 'pointer', marginTop: '8px', fontFamily: 'Sora, sans-serif' },
  secondaryButton: { width: '100%', padding: '12px', fontSize: '14px', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', marginTop: '4px' },
  spinner: { width: '32px', height: '32px', border: '3px solid var(--accent-purple)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' },
};