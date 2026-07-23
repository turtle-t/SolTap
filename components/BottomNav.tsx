'use client';

import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/referral', label: 'Refer', icon: ReferIcon },
  { href: '/withdraw', label: 'Withdraw', icon: WithdrawIcon },
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
            <span style={{ ...styles.label, color: active ? 'var(--text)' : 'var(--text-muted)' }}>
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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 11.5L12 4l8 7.5M6 10v9a1 1 0 001 1h3v-5h4v5h3a1 1 0 001-1v-9"
        stroke={active ? 'url(#g1)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#9945FF" /><stop offset="1" stopColor="#14F195" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ReferIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="8" r="3" stroke={active ? 'url(#g2)' : 'var(--text-muted)'} strokeWidth="2" />
      <circle cx="17" cy="16" r="3" stroke={active ? 'url(#g2)' : 'var(--text-muted)'} strokeWidth="2" />
      <path d="M10.5 9.5L14.5 14" stroke={active ? 'url(#g2)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="g2" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#9945FF" /><stop offset="1" stopColor="#14F195" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function WithdrawIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="12" rx="2" stroke={active ? 'url(#g3)' : 'var(--text-muted)'} strokeWidth="2" />
      <path d="M3 10h18M7 15h4" stroke={active ? 'url(#g3)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="g3" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#9945FF" /><stop offset="1" stopColor="#14F195" />
        </linearGradient>
      </defs>
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
    background: 'rgba(28, 25, 48, 0.92)',
    backdropFilter: 'blur(12px)',
    borderTop: '1px solid var(--border)',
    padding: '10px 0 calc(10px + env(safe-area-inset-bottom))',
    zIndex: 500,
  },
  tabButton: {
    background: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 18px',
    cursor: 'pointer',
    position: 'relative',
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
  },
  activeDot: {
    position: 'absolute',
    top: '-10px',
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    background: 'var(--accent-teal)',
  },
};