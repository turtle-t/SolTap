'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Telegram: any;
  }
}

interface TaskData {
  daily: { current: number; target: number; rewardUsd: number; completed: boolean };
  streak: { current: number; target: number; rewardUsd: number };
}

export default function TasksPage() {
  const [data, setData] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const tg = window.Telegram?.WebApp;
      if (!tg?.initData) { setLoading(false); return; }

      const res = await fetch('/api/tasks-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData }),
      });
      const result = await res.json();
      if (res.ok) setData(result);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <main style={styles.centerScreen}>LOADING...</main>;
  if (!data) return <main style={styles.centerScreen}>Open inside Telegram to view tasks.</main>;

  const dailyPct = Math.min((data.daily.current / data.daily.target) * 100, 100);
  const streakPct = Math.min((data.streak.current / data.streak.target) * 100, 100);

  return (
    <main style={styles.page}>
      <p className="pixel-font" style={styles.eyebrow}>QUESTS</p>
      <h1 className="pixel-font" style={styles.heading}>TASKS</h1>

      {/* Daily task */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span className="pixel-font" style={styles.cardTitle}>DAILY GRIND</span>
          <span className="pixel-font" style={styles.reward}>+${data.daily.rewardUsd.toFixed(2)}</span>
        </div>
        <p style={styles.cardDesc}>Watch {data.daily.target} ads today to earn a bonus.</p>
        <div style={styles.barTrack}>
          <div style={{ ...styles.barFill, width: `${dailyPct}%`, background: 'var(--coin-gold)' }} />
        </div>
        <p className="pixel-font" style={styles.barLabel}>
          {data.daily.current} / {data.daily.target} {data.daily.completed ? '— CLAIMED ✓' : ''}
        </p>
      </div>

      {/* Streak task */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span className="pixel-font" style={styles.cardTitle}>7-DAY STREAK</span>
          <span className="pixel-font" style={styles.reward}>+${data.streak.rewardUsd.toFixed(2)}</span>
        </div>
        <p style={styles.cardDesc}>Hit your daily goal 7 days in a row.</p>
        <div style={styles.dotsRow}>
          {Array.from({ length: data.streak.target }).map((_, i) => (
            <div key={i} style={{
              ...styles.dot,
              background: i < data.streak.current ? 'var(--coin-teal)' : 'var(--surface)',
              borderColor: i < data.streak.current ? 'var(--coin-teal)' : 'var(--border)',
            }}>
              {i < data.streak.current ? '🔥' : ''}
            </div>
          ))}
        </div>
        <p className="pixel-font" style={styles.barLabel}>
          DAY {data.streak.current} / {data.streak.target}
        </p>
      </div>

      <div style={styles.hint}>
        Both tasks progress automatically as you watch ads on the Home tab.
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '24px 20px', maxWidth: '480px', margin: '0 auto', textAlign: 'center' },
  centerScreen: { padding: '20px', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Press Start 2P', monospace", fontSize: '12px' },
  eyebrow: { fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '6px' },
  heading: { fontSize: '16px', margin: '0 0 20px' },
  card: {
    background: 'var(--surface)', border: '4px solid var(--border)', borderRadius: '4px',
    padding: '18px', marginBottom: '18px', boxShadow: '5px 5px 0 rgba(0,0,0,0.4)', textAlign: 'left',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  cardTitle: { fontSize: '11px', color: 'var(--text)' },
  reward: { fontSize: '11px', color: 'var(--coin-gold)' },
  cardDesc: { fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 14px' },
  barTrack: { width: '100%', height: '14px', background: '#0f0e1a', border: '2px solid var(--border)', borderRadius: '3px', overflow: 'hidden' },
  barFill: { height: '100%', transition: 'width 0.3s ease' },
  barLabel: { fontSize: '9px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right' },
  dotsRow: { display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '4px' },
  dot: { width: '28px', height: '28px', border: '2px solid', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' },
  hint: { fontSize: '13px', color: 'var(--text-muted)', marginTop: '10px' },
};