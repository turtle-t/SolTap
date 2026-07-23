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

const MIN_AD_WATCH_SECONDS = 10; // must match the server's MIN_AD_WATCH_SECONDS

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultSuccess, setResultSuccess] = useState(false);

  useEffect(() => {
    async function authenticate() {
      try {
        const tg = window.Telegram?.WebApp;

        if (!tg) {
          setError('This app must be opened inside Telegram.');
          setLoading(false);
          return;
        }

        tg.ready();
        const initData = tg.initData;

        if (!initData) {
          setError('No Telegram data found. Open this app via your Telegram bot.');
          setLoading(false);
          return;
        }

        const fingerprint = generateFingerprint();

        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData, fingerprint }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Authentication failed');
        } else {
          setUser(data.user);
        }
      } catch (err) {
        setError('Something went wrong connecting to the server.');
      } finally {
        setLoading(false);
      }
    }

    authenticate();
  }, []);

  async function refreshBalance() {
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) return;

    const fingerprint = generateFingerprint();
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: tg.initData, fingerprint }),
    });
    const data = await res.json();
    if (res.ok) setUser(data.user);
  }

  function startFlow() {
    setResultMessage(null);
    setFlowState('instructions');
  }

  async function beginWatchingAd() {
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) {
      setResultMessage('Telegram session not found.');
      setResultSuccess(false);
      setFlowState('result');
      return;
    }

    setFlowState('watching');

    try {
      const startRes = await fetch('/api/ad-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      });
      const startData = await startRes.json();

      if (!startRes.ok) {
        setResultMessage(startData.error || 'Could not start ad session.');
        setResultSuccess(false);
        setFlowState('result');
        return;
      }

      const adEventId = startData.adEventId;

      await window.show_11374343();

      setFlowState('verifying');

      const res = await fetch('/api/claim-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData, adEventId }),
      });

      const data = await res.json();

      if (res.ok) {
        setResultMessage(data.message || 'Points credited!');
        setResultSuccess(true);
        await refreshBalance();
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

  function closeOverlay() {
    setFlowState('idle');
  }

  if (loading) {
    return <main style={styles.centerScreen}>Loading...</main>;
  }

  if (error) {
    return (
      <main style={{ ...styles.centerScreen, color: '#e05252' }}>
        {error}
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <h1 style={styles.heading}>Welcome, {user?.username}</h1>

      <div style={styles.balanceCard}>
        <p style={styles.balanceLabel}>Your Balance</p>
        <p style={styles.balanceValue}>{user?.points_balance} points</p>
      </div>

      <button style={styles.watchButton} onClick={startFlow}>
        Watch Ad to Earn
      </button>
      <a href="/referral" style={{ display: 'block', textAlign: 'center', marginBottom: '16px', color: '#2481cc' }}>
  Invite Friends →
</a>

      <div style={styles.bannerSlot}>Banner ad slot (placeholder)</div>


      {/* Overlay flow: instructions -> watching -> verifying -> result */}
      {flowState !== 'idle' && (
        <div style={styles.overlayBackdrop}>
          <div style={styles.overlayCard}>
            {flowState === 'instructions' && (
              <>
                <h2 style={styles.overlayTitle}>Before you start</h2>
                <ul style={styles.instructionList}>
                  <li>Tap <strong>Start Ad</strong> below.</li>
                  <li>Wait for the ad's own timer to finish completely — don't close it early.</li>
                  <li>After the timer ends, tap <strong>Continue</strong> inside the ad.</li>
                  <li>You'll be brought back here automatically — stay on this screen.</li>
                  <li>If you close the ad before it finishes, you will <strong>not</strong> receive any points.</li>
                </ul>
                <button style={styles.primaryButton} onClick={beginWatchingAd}>
                  Start Ad
                </button>
                <button style={styles.secondaryButton} onClick={closeOverlay}>
                  Cancel
                </button>
              </>
            )}

            {flowState === 'watching' && (
              <>
                <div style={styles.spinner} />
                <p style={styles.overlayText}>Loading your ad…</p>
                <p style={styles.overlaySubtext}>
                  Please wait for it to finish before tapping Continue.
                </p>
              </>
            )}

            {flowState === 'verifying' && (
              <>
                <div style={styles.spinner} />
                <p style={styles.overlayText}>Verifying your ad view…</p>
                <p style={styles.overlaySubtext}>This will only take a moment.</p>
              </>
            )}

            {flowState === 'result' && (
              <>
                <p style={{
                  ...styles.overlayText,
                  color: resultSuccess ? '#3ecf8e' : '#e05252',
                  fontSize: '20px',
                }}>
                  {resultMessage}
                </p>
                <button style={styles.primaryButton} onClick={closeOverlay}>
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: '20px',
    maxWidth: '480px',
    margin: '0 auto',
    fontFamily: 'system-ui, sans-serif',
  },
  centerScreen: {
    padding: '20px',
    textAlign: 'center',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: '22px',
    marginBottom: '8px',
  },
  balanceCard: {
    background: 'linear-gradient(135deg, #1e2a3a, #14202e)',
    borderRadius: '16px',
    padding: '28px',
    textAlign: 'center',
    margin: '20px 0',
    color: '#fff',
  },
  balanceLabel: {
    fontSize: '14px',
    color: '#9fb3c8',
    margin: 0,
  },
  balanceValue: {
    fontSize: '38px',
    fontWeight: 700,
    margin: '8px 0 0',
  },
  watchButton: {
    width: '100%',
    padding: '16px',
    fontSize: '18px',
    fontWeight: 700,
    background: '#2481cc',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  bannerSlot: {
    marginTop: '20px',
    textAlign: 'center',
    color: '#999',
    fontSize: '14px',
  },
  overlayBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  overlayCard: {
    background: '#182430',
    borderRadius: '16px',
    padding: '28px 24px',
    maxWidth: '380px',
    width: '100%',
    textAlign: 'center',
    color: '#fff',
  },
  overlayTitle: {
    fontSize: '20px',
    marginBottom: '16px',
  },
  instructionList: {
    textAlign: 'left',
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#c8d6e5',
    marginBottom: '20px',
    paddingLeft: '20px',
  },
  overlayText: {
    fontSize: '17px',
    fontWeight: 600,
    marginBottom: '8px',
  },
  overlaySubtext: {
    fontSize: '13px',
    color: '#9fb3c8',
  },
  primaryButton: {
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 700,
    background: '#2481cc',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    marginTop: '8px',
  },
  secondaryButton: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    background: 'transparent',
    color: '#9fb3c8',
    border: 'none',
    cursor: 'pointer',
    marginTop: '8px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #2481cc',
    borderTopColor: 'transparent',
    borderRadius: '50%',
    margin: '0 auto 16px',
    animation: 'spin 0.8s linear infinite',
  },
};