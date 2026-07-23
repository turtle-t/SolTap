'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Telegram: any;
  }
}

interface ReferralData {
  telegramId: number;
  referredCount: number;
  totalReferralEarnings: number;
  referrals: {
    username: string;
    firstAdVerified: boolean;
    milestonePaid: boolean;
    totalRevenue: number;
    joinedAt: string;
  }[];
}

const BOT_USERNAME = 'tap4sol_bot'; // your actual bot username
const APP_SHORT_NAME = 'soltap'; // your actual mini app short name

export default function ReferralPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const tg = window.Telegram?.WebApp;
      if (!tg?.initData) {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/referral-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      });

      const result = await res.json();
      if (res.ok) setData(result);
      setLoading(false);
    }

    load();
  }, []);

  function getReferralLink() {
    if (!data) return '';
    return `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}?startapp=ref_${data.telegramId}`;
  }

  function copyLink() {
    navigator.clipboard.writeText(getReferralLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareLink() {
    const tg = window.Telegram?.WebApp;
    const link = getReferralLink();
    const text = 'Join me and start earning Solana by watching ads!';
    tg?.openTelegramLink(
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
    );
  }

  if (loading) {
    return <main style={{ padding: '20px', textAlign: 'center' }}>Loading...</main>;
  }

  if (!data) {
    return (
      <main style={{ padding: '20px', textAlign: 'center' }}>
        Open this page inside Telegram to see your referral link.
      </main>
    );
  }

  return (
    <main style={{ padding: '20px', maxWidth: '480px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '22px' }}>Invite Friends</h1>

      <div style={{
        background: 'linear-gradient(135deg, #1e2a3a, #14202e)',
        borderRadius: '16px',
        padding: '20px',
        color: '#fff',
        margin: '16px 0',
      }}>
        <p style={{ fontSize: '13px', color: '#9fb3c8', margin: 0 }}>Your referral link</p>
        <p style={{
          fontSize: '13px',
          wordBreak: 'break-all',
          background: '#0e1620',
          padding: '10px',
          borderRadius: '8px',
          margin: '8px 0',
        }}>
          {getReferralLink()}
        </p>

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button onClick={copyLink} style={btnStyle}>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button onClick={shareLink} style={{ ...btnStyle, background: '#2481cc' }}>
            Share
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', margin: '16px 0' }}>
        <div style={statCard}>
          <p style={statLabel}>Referred</p>
          <p style={statValue}>{data.referredCount}</p>
        </div>
        <div style={statCard}>
          <p style={statLabel}>Points Earned</p>
          <p style={statValue}>{data.totalReferralEarnings}</p>
        </div>
      </div>

      <h2 style={{ fontSize: '16px', marginTop: '24px' }}>Your Referrals</h2>

      {data.referrals.length === 0 ? (
        <p style={{ color: '#999', fontSize: '14px' }}>
          No referrals yet — share your link to start earning!
        </p>
      ) : (
        <div>
          {data.referrals.map((r, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px',
              borderBottom: '1px solid #2a3847',
              fontSize: '14px',
            }}>
              <span>{r.username}</span>
              <span style={{ color: r.firstAdVerified ? '#3ecf8e' : '#999' }}>
                {r.firstAdVerified ? 'Active' : 'Pending first ad'}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

const btnStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px',
  fontSize: '14px',
  fontWeight: 600,
  background: '#2a3847',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
};

const statCard: React.CSSProperties = {
  flex: 1,
  background: '#182430',
  borderRadius: '12px',
  padding: '16px',
  textAlign: 'center',
};

const statLabel: React.CSSProperties = {
  fontSize: '12px',
  color: '#9fb3c8',
  margin: 0,
};

const statValue: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  color: '#fff',
  margin: '4px 0 0',
};