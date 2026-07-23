'use client';

import { useEffect, useState } from 'react';

interface Withdrawal {
  id: number;
  user_id: number;
  username: string;
  telegram_id: number;
  flagged: boolean;
  points_spent: number;
  wallet_address: string;
  status: string;
  requested_at: string;
}

interface User {
  id: number;
  telegram_id: number;
  username: string;
  points_balance: number;
  flagged: boolean;
  flag_reason: string | null;
  created_at: string;
  last_ip: string;
  verified_ad_count: number;
  referral_count: number;
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<'withdrawals' | 'users'>('withdrawals');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadWithdrawals() {
    const res = await fetch('/api/admin/withdrawals');
    if (res.ok) {
      const data = await res.json();
      setWithdrawals(data.withdrawals);
    }
  }

  async function loadUsers() {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
  }

  useEffect(() => {
    Promise.all([loadWithdrawals(), loadUsers()]).finally(() => setLoading(false));
  }, []);

  async function handleWithdrawalAction(withdrawalId: number, action: 'approve' | 'reject') {
    const confirmMsg = action === 'approve'
      ? 'Confirm you have manually sent the SOL to this address before approving.'
      : 'Reject this withdrawal and refund points to the user?';

    if (!confirm(confirmMsg)) return;

    const res = await fetch('/api/admin/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ withdrawalId, action }),
    });

    if (res.ok) {
      await loadWithdrawals();
    } else {
      alert('Action failed');
    }
  }

  if (loading) {
    return <main style={{ padding: '20px' }}>Loading...</main>;
  }

  return (
    <main style={{ padding: '20px', maxWidth: '900px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '22px' }}>Admin Dashboard</h1>

      <div style={{ display: 'flex', gap: '8px', margin: '16px 0' }}>
        <button
          onClick={() => setTab('withdrawals')}
          style={{
            padding: '8px 16px',
            background: tab === 'withdrawals' ? '#2481cc' : '#e0e0e0',
            color: tab === 'withdrawals' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Withdrawals
        </button>
        <button
          onClick={() => setTab('users')}
          style={{
            padding: '8px 16px',
            background: tab === 'users' ? '#2481cc' : '#e0e0e0',
            color: tab === 'users' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Users
        </button>
      </div>

      {tab === 'withdrawals' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>User</th>
              <th style={{ padding: '8px' }}>Points</th>
              <th style={{ padding: '8px' }}>Wallet</th>
              <th style={{ padding: '8px' }}>Status</th>
              <th style={{ padding: '8px' }}>Requested</th>
              <th style={{ padding: '8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((w) => (
              <tr key={w.id} style={{
                borderBottom: '1px solid #eee',
                background: w.flagged ? '#fff3f3' : 'transparent',
              }}>
                <td style={{ padding: '8px' }}>
                  {w.username} {w.flagged && <span style={{ color: '#e05252', fontSize: '12px' }}>⚠ FLAGGED</span>}
                </td>
                <td style={{ padding: '8px' }}>{w.points_spent}</td>
                <td style={{ padding: '8px', fontSize: '12px' }}>
                  {w.wallet_address.slice(0, 6)}...{w.wallet_address.slice(-6)}
                </td>
                <td style={{ padding: '8px', textTransform: 'capitalize' }}>{w.status}</td>
                <td style={{ padding: '8px' }}>{new Date(w.requested_at).toLocaleDateString()}</td>
                <td style={{ padding: '8px' }}>
                  {w.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleWithdrawalAction(w.id, 'approve')}
                        style={{ marginRight: '6px', padding: '4px 10px', background: '#3ecf8e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleWithdrawalAction(w.id, 'reject')}
                        style={{ padding: '4px 10px', background: '#e05252', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'users' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>User</th>
              <th style={{ padding: '8px' }}>Balance</th>
              <th style={{ padding: '8px' }}>Verified Ads</th>
              <th style={{ padding: '8px' }}>Referrals</th>
              <th style={{ padding: '8px' }}>IP</th>
              <th style={{ padding: '8px' }}>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{
                borderBottom: '1px solid #eee',
                background: u.flagged ? '#fff3f3' : 'transparent',
              }}>
                <td style={{ padding: '8px' }}>
                  {u.username} {u.flagged && <span style={{ color: '#e05252', fontSize: '12px' }} title={u.flag_reason || ''}>⚠ FLAGGED</span>}
                </td>
                <td style={{ padding: '8px' }}>{u.points_balance}</td>
                <td style={{ padding: '8px' }}>{u.verified_ad_count}</td>
                <td style={{ padding: '8px' }}>{u.referral_count}</td>
                <td style={{ padding: '8px', fontSize: '12px' }}>{u.last_ip}</td>
                <td style={{ padding: '8px' }}>{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}