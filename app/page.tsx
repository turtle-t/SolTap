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

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

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

  async function handleWatchAd() {
    setClaimMessage(null);

    try {
      // Trigger the Monetag Rewarded Interstitial
      await window.show_11374343();

      // Ad watched successfully — notify our server to verify + claim points
      setClaiming(true);
      const tg = window.Telegram?.WebApp;

      const res = await fetch('/api/claim-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      });

      const data = await res.json();

      if (res.ok) {
        setClaimMessage(data.message || 'Points credited!');
        await refreshBalance();
      } else {
        setClaimMessage(data.error || 'Could not claim reward.');
      }
    } catch (err) {
      // User closed the ad early, or it failed to load
      setClaimMessage('Ad was not completed.');
    } finally {
      setClaiming(false);
    }
  }

  if (loading) {
    return <main style={{ padding: '20px', textAlign: 'center' }}>Loading...</main>;
  }

  if (error) {
    return (
      <main style={{ padding: '20px', textAlign: 'center', color: '#c00' }}>
        {error}
      </main>
    );
  }

  return (
    <main style={{ padding: '20px', maxWidth: '480px', margin: '0 auto' }}>
      <h1>Welcome, {user?.username}</h1>

      <div style={{
        background: '#f0f0f0',
        borderRadius: '12px',
        padding: '24px',
        textAlign: 'center',
        margin: '20px 0'
      }}>
        <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>Your Balance</p>
        <p style={{ fontSize: '36px', fontWeight: 'bold', margin: '8px 0' }}>
          {user?.points_balance} points
        </p>
      </div>

      <button
        onClick={handleWatchAd}
        disabled={claiming}
        style={{
          width: '100%',
          padding: '16px',
          fontSize: '18px',
          fontWeight: 'bold',
          background: claiming ? '#999' : '#2481cc',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          cursor: claiming ? 'default' : 'pointer'
        }}
      >
        {claiming ? 'Claiming...' : 'Watch Ad to Earn'}
      </button>

      {claimMessage && (
        <p style={{ textAlign: 'center', marginTop: '12px', color: '#444' }}>
          {claimMessage}
        </p>
      )}

      <div style={{ marginTop: '20px', textAlign: 'center', color: '#999', fontSize: '14px' }}>
        Banner ad slot (placeholder)
      </div>
    </main>
  );
}