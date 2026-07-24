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

const BOT_USERNAME = 'tap4sol_bot';
const APP_SHORT_NAME = 'soltap';
const POINTS_PER_DOLLAR = 1000;

// Reward structure — matches claim-reward/route.ts constants
const SIGNUP_BONUS_USD = 100 / POINTS_PER_DOLLAR;
const MILESTONE_USD = 1000 / POINTS_PER_DOLLAR;
const MILESTONE_TRIGGER_USD = 10;
const COMMISSION_PERCENT = 2;

export default function ReferralPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const tg = window.Telegram?.WebApp;
      if (!tg?.initData) { setLoading(false); return; }

      const res = await fetch('/api/referral-stats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    const text = 'Join me and start earning by watching ads!';
    tg?.openTelegramLink(
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
    );
  }

  if (loading) return <main style={styles.centerScreen}>LOADING...</main>;
  if (!data) return <main style={styles.centerScreen}>Open inside Telegram to see your link.</main>;

  const earningsUsd = (data.totalReferralEarnings / POINTS_PER_DOLLAR).toFixed(3);

  return (
    <main style={styles.page}>
      <p className="pixel-font" style={styles.eyebrow}>SQUAD UP</p>
      <h1 className="pixel-font" style={styles.heading}>INVITE FRIENDS</h1>

      {/* Reward breakdown — the actual "how much per referral" */}
      <div style={styles.rewardCard}>
        <div style={styles.rewardRow}>
          <span style={styles.rewardIcon}>🎁</span>
          <div>
            <p className="pixel-font" style={styles.rewardAmount}>+${SIGNUP_BONUS_USD.toFixed(2)}</p>
            <p style={styles.rewardDesc}>the moment your friend watches their first ad</p>
          </div>
        </div>
        <div style={styles.rewardRow}>
          <span style={styles.rewardIcon}>🏆</span>
          <div>
            <p className="pixel-font" style={styles.rewardAmount}>+${MILESTONE_USD.toFixed(2)}</p>
            <p style={styles.rewardDesc}>bonus once they earn ${MILESTONE_TRIGGER_USD} total</p>
          </div>
        </div>
        <div style={styles.rewardRow}>
          <span style={styles.rewardIcon}>♾️</span>
          <div>
            <p className="pixel-font" style={styles.rewardAmount}>{COMMISSION_PERCENT}%</p>
            <p style={styles.rewardDesc}>of everything they earn, forever</p>
          </div>
        </div>
      </div>

      <div style={styles.linkCard}>
        <p className="pixel-font" style={styles.linkLabel}>YOUR LINK</p>
        <p style={styles.linkText}>{getReferralLink()}</p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button className="pixel-font" onClick={copyLink} style={styles.btn}>
            {copied ? 'COPIED!' : 'COPY'}
          </button>
          <button className="pixel-font" onClick={shareLink} style={{ ...styles.btn, background: 'var(--coin-gold)', color: '#1a1408' }}>
            SHARE
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', margin: '18px 0' }}>
        <div style={styles.statCard}>
          <p className="pixel-font" style={styles.statLabel}>REFERRED</p>
          <p className="pixel-font" style={styles.statValue}>{data.referredCount}</p>
        </div>
        <div style={styles.statCard}>
          <p className="pixel-font" style={styles.statLabel}>EARNED</p>
          <p className="pixel-font" style={{ ...styles.statValue, color: 'var(--coin-gold)' }}>${earningsUsd}</p>
        </div>
      </div>

      <h2 className="pixel-font" style={styles.subheading}>YOUR REFERRALS</h2>

      {data.referrals.length === 0 ? (
        <p style={styles.emptyText}>No referrals yet — share your link above!</p>
      ) : (
        <div>
          {data.referrals.map((r, i) => (
            <div key={i} style={styles.referralRow}>
              <span>{r.username}</span>
              <span className="pixel-font" style={{ fontSize: '8px', color: r.firstAdVerified ? 'var(--coin-teal)' : 'var(--text-muted)' }}>
                {r.firstAdVerified ? 'ACTIVE' : 'PENDING'}
              </span>
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
  rewardCard: {
    background: 'var(--surface)', border: '4px solid var(--border)', borderRadius: '4px',
    padding: '16px', marginBottom: '18px', boxShadow: '5px 5px 0 rgba(0,0,0,0.4)', textAlign: 'left',
  },
  rewardRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '2px dashed var(--border)' },
  rewardIcon: { fontSize: '22px' },
  rewardAmount: { fontSize: '13px', color: 'var(--coin-gold)', margin: 0 },
  rewardDesc: { fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' },
  linkCard: {
    background: 'var(--surface)', border: '4px solid var(--border)', borderRadius: '4px',
    padding: '16px', marginBottom: '4px', boxShadow: '5px 5px 0 rgba(0,0,0,0.4)', textAlign: 'left',
  },
  linkLabel: { fontSize: '9px', color: 'var(--text-muted)', margin: 0 },
  linkText: { fontSize: '13px', wordBreak: 'break-all', background: '#0f0e1a', border: '2px solid var(--border)', borderRadius: '3px', padding: '10px', margin: '8px 0 0' },
  btn: {
    flex: 1, padding: '12px', fontSize: '10px', background: 'var(--border)', color: 'var(--text)',
    border: '3px solid #0f0e1a', borderRadius: '3px', cursor: 'pointer', boxShadow: '3px 3px 0 rgba(0,0,0,0.4)',
  },
  statCard: { flex: 1, background: 'var(--surface)', border: '3px solid var(--border)', borderRadius: '4px', padding: '14px', textAlign: 'center' },
  statLabel: { fontSize: '8px', color: 'var(--text-muted)', margin: 0 },
  statValue: { fontSize: '18px', margin: '6px 0 0', color: 'var(--text)' },
  subheading: { fontSize: '12px', textAlign: 'left', margin: '20px 0 10px' },
  emptyText: { color: 'var(--text-muted)', fontSize: '14px', textAlign: 'left' },
  referralRow: { display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '2px solid var(--border)', fontSize: '14px' },
};