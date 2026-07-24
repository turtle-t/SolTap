'use client';

import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  { href: '/', label: 'HOME', icon: HomeIcon },
  { href: '/tasks', label: 'TASKS', icon: TasksIcon },
  { href: '/referral', label: 'REFER', icon: ReferIcon },
  { href: '/withdraw', label: 'CASH', icon: WithdrawIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav style={styles.nav}>
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            style={styles.tabButton}
          >
            <Icon active={active} />
            <span className="pixel-font" style={{ ...styles.label, color: active ? 'var(--coin-gold)' : 'var(--text-muted)' }}>
              {tab.label}
            </span>
            {active && <span style={styles.activeDot} />}
          </button>
        );
      })}
    </nav>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 11.5L12 4l8 7.5M6 10v9a1 1 0 001 1h3v-5h4v5h3a1 1 0 001-1v-9"
        stroke={active ? 'var(--coin-gold)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TasksIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="1" stroke={active ? 'var(--coin-gold)' : 'var(--text-muted)'} strokeWidth="2" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke={active ? 'var(--coin-gold)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ReferIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="8" r="3" stroke={active ? 'var(--coin-gold)' : 'var(--text-muted)'} strokeWidth="2" />
      <circle cx="17" cy="16" r="3" stroke={active ? 'var(--coin-gold)' : 'var(--text-muted)'} strokeWidth="2" />
      <path d="M10.5 9.5L14.5 14" stroke={active ? 'var(--coin-gold)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WithdrawIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="12" rx="1" stroke={active ? 'var(--coin-gold)' : 'var(--text-muted)'} strokeWidth="2" />
      <path d="M3 10h18M7 15h4" stroke={active ? 'var(--coin-gold)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-around',
    background: 'var(--surface)',
    borderTop: '4px solid var(--border)',
    padding: '10px 0 calc(10px + env(safe-area-inset-bottom))',
    zIndex: 500,
  },
  tabButton: {
    background: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 8px',
    cursor: 'pointer',
    position: 'relative',
  },
  label: {
    fontSize: '8px',
  },
  activeDot: {
    position: 'absolute',
    top: '-10px',
    width: '5px',
    height: '5px',
    background: 'var(--coin-gold)',
  },
};