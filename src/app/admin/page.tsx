'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  ShieldCheck,
  UserPlus,
  RefreshCw,
  LogOut,
  Smartphone,
  Key,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

interface AdminUser {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string;
  role: string;
  tier: string;
  subscription_status: string;
  current_device_id: string | null;
  device_name: string | null;
  last_active_at: string;
  otps?: Array<{
    id: string;
    code: string;
    is_consumed: boolean;
    expires_at: string;
    created_at?: string;
  }>;
}

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTier, setNewTier] = useState('free');
  const [newStatus, setNewStatus] = useState('active');
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [reissuedOtpInfo, setReissuedOtpInfo] = useState<{ userName: string; code: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const router = useRouter();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok && data.users) {
        setUsers(data.users);
      }
    } catch {
      console.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('urji_user');
    if (!raw) {
      router.push('/login');
      return;
    }
    try {
      const u = JSON.parse(raw);
      if (u.role !== 'admin') {
        alert('Access denied. Admin role required.');
        router.push('/dashboard');
        return;
      }
    } catch {
      router.push('/login');
    }
    fetchUsers();
  }, [router, fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newName,
          phone: newPhone || null,
          email: newEmail || null,
          tier: newTier,
          subscription_status: newStatus,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setModalSuccess(`User created! Generated 6-digit OTP: ${data.otp.code}`);
        fetchUsers();
        setNewName('');
        setNewPhone('');
        setNewEmail('');
      } else {
        alert(data.error || 'Failed to create user');
      }
    } catch {
      alert('Network error creating user');
    }
  };

  const handleReissueOtp = async (userId: string, userName: string) => {
    try {
      const res = await fetch('/api/admin/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok && data.code) {
        setReissuedOtpInfo({ userName, code: data.code });
        // Optimistically update the user row with the fresh OTP so it displays immediately
        setUsers((prev) =>
          prev.map((usr) =>
            usr.id === userId
              ? {
                  ...usr,
                  otps: [
                    data.otp,
                    ...(usr.otps || []).map((o) =>
                      o.code === '123456' || o.code === '999999' ? o : { ...o, is_consumed: true }
                    ),
                  ],
                }
              : usr
          )
        );
        fetchUsers();
      } else {
        alert(data.error || 'Failed to re-issue OTP');
      }
    } catch {
      alert('Error re-issuing OTP');
    }
  };


  const handleRevokeDevice = async (userId: string, userName: string) => {
    // Immediate optimistic update in UI
    setUsers((prev) =>
      prev.map((usr) =>
        usr.id === userId
          ? { ...usr, current_device_id: null, device_name: null }
          : usr
      )
    );
    setReissuedOtpInfo({ userName, code: 'DEVICE REVOKED' });

    try {
      const res = await fetch('/api/admin/revoke-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchUsers();
      } else {
        alert(data.error || 'Failed to revoke device');
        fetchUsers();
      }
    } catch {
      alert('Error revoking device');
      fetchUsers();
    }
  };


  const handleToggleTier = async (userId: string, currentTier: string) => {
    const nextTier = currentTier === 'premium' ? 'free' : 'premium';
    try {
      const res = await fetch('/api/admin/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier: nextTier }),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch {
      alert('Error toggling subscription tier');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeCount = users.filter((u) => u.subscription_status === 'active').length;
  const boundCount = users.filter((u) => u.current_device_id).length;

  return (
    <div className="min-h-screen bg-[#F3EFE5] p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#14201A]/10">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#0B3D2E] mb-1">
              <ShieldCheck className="w-4 h-4" /> Admin Console
            </div>
            <h1 className="font-serif text-3xl md:text-4xl text-[#0B3D2E] font-medium tracking-tight">
              User & Subscription Management
            </h1>
            <p className="text-sm text-[rgb(90,102,96)] mt-0.5">
              Provision users, issue single-use OTPs, enforce device-locking, and manage subscription statuses.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle variant="pill" />
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#14201A]/10 rounded-xl text-xs font-semibold text-[#14201A] hover:bg-[#F2F7D9]/50 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" /> User App
            </Link>
            <button
              onClick={() => {
                setShowModal(true);
                setModalSuccess(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9] rounded-xl text-xs font-semibold transition-all shadow-sm"
            >
              <UserPlus className="w-4 h-4" /> Register New User
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-[rgb(90,102,96)] tracking-wider">
                Total Users
              </span>
              <Users className="w-5 h-5 text-[#0B3D2E]" />
            </div>
            <div className="font-serif text-3xl text-[#14201A] mt-2">{users.length}</div>
          </div>

          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-[rgb(90,102,96)] tracking-wider">
                Active Subscriptions
              </span>
              <ShieldCheck className="w-5 h-5 text-[#3B7A57]" />
            </div>
            <div className="font-serif text-3xl text-[#14201A] mt-2">
              {activeCount} <span className="text-xs font-sans text-[rgb(90,102,96)]">/ {users.length}</span>
            </div>
          </div>

          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-[rgb(90,102,96)] tracking-wider">
                Bound Active Devices
              </span>
              <Smartphone className="w-5 h-5 text-[#C1502E]" />
            </div>
            <div className="font-serif text-3xl text-[#14201A] mt-2">{boundCount}</div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[#14201A]/10 flex items-center justify-between">
            <h2 className="font-serif text-2xl text-[#14201A]">Provisioned Accounts</h2>
            <button
              onClick={fetchUsers}
              className="p-2 text-[rgb(90,102,96)] hover:text-[#0B3D2E] hover:bg-black/5 rounded-lg transition-colors"
              title="Refresh users"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Re-issued OTP Notification Banner */}
          {reissuedOtpInfo && (
            <div className="p-4 bg-[#F2F7D9] border-b border-[#0B3D2E]/20 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0B3D2E] text-[#F2F7D9] flex items-center justify-center font-bold text-xs shadow-xs">
                  <Key className="w-4 h-4 text-[#F2F7D9]" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#0B3D2E] uppercase tracking-wider">
                    Fresh OTP Issued for {reissuedOtpInfo.userName}
                  </div>
                  <div className="font-mono font-extrabold text-2xl text-[#0B3D2E] tracking-widest mt-0.5">
                    {reissuedOtpInfo.code}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(reissuedOtpInfo.code, 'banner')}
                  className="px-3.5 py-2 bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  {copiedId === 'banner' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedId === 'banner' ? 'Copied to Clipboard!' : 'Copy OTP'}
                </button>
                <button
                  onClick={() => setReissuedOtpInfo(null)}
                  className="p-2 text-[#0B3D2E]/60 hover:text-[#0B3D2E] hover:bg-black/5 rounded-lg text-sm"
                  title="Dismiss banner"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F3EFE5]/50 border-b border-[#14201A]/10 text-[11px] font-semibold uppercase tracking-wider text-[rgb(90,102,96)]">
                  <th className="p-4">User</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Tier</th>
                  <th className="p-4">Device Lock</th>
                  <th className="p-4">Latest OTP</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#14201A]/5 text-sm">
                {users.map((u) => {
                  const latestOtp = u.otps && u.otps.length > 0
                    ? [...u.otps].sort(
                        (a, b) =>
                          new Date(b.created_at || b.expires_at).getTime() -
                          new Date(a.created_at || a.expires_at).getTime()
                      )[0]
                    : null;


                  return (
                    <tr key={u.id} className="hover:bg-white/60 transition-colors">
                      <td className="p-4 font-medium text-[#14201A]">
                        <div>{u.full_name}</div>
                        <span className="text-[11px] uppercase font-semibold text-[rgb(90,102,96)] tracking-wider">
                          {u.role}
                        </span>
                      </td>

                      <td className="p-4 text-xs text-[rgb(90,102,96)] font-mono">
                        <div>{u.phone || '—'}</div>
                        <div className="text-[11px] text-[rgb(90,102,96)]">{u.email || ''}</div>
                      </td>

                      <td className="p-4">
                        <button
                          onClick={() => handleToggleTier(u.id, u.tier)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide transition-all ${
                            u.tier === 'premium'
                              ? 'bg-[#F2F7D9] text-[#0B3D2E] border border-[#0B3D2E]/20'
                              : 'bg-black/5 text-[rgb(90,102,96)]'
                          }`}
                        >
                          {u.tier === 'premium' ? (
                            <ToggleRight className="w-4 h-4 text-[#0B3D2E]" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 text-[rgb(90,102,96)]" />
                          )}
                          {u.tier}
                        </button>
                      </td>

                      <td className="p-4 text-xs">
                        {u.current_device_id ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="font-mono text-[11px] text-[#14201A] truncate max-w-[100px]" title={u.current_device_id}>
                              {u.current_device_id.slice(0, 8)}…
                            </span>
                            <button
                              onClick={() => handleRevokeDevice(u.id, u.full_name)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 hover:bg-red-100 text-[#C1502E] border border-red-200/80 rounded text-[11px] font-semibold transition-colors cursor-pointer ml-1"
                              title="Manually force device logout & unlock user"
                            >
                              <LogOut className="w-3 h-3 text-[#C1502E]" />
                              Revoke
                            </button>
                          </div>
                        ) : (
                          <span className="text-[rgb(90,102,96)] italic text-xs flex items-center gap-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-black/20" />
                            Unlocked (No Device)
                          </span>
                        )}
                      </td>


                      <td className="p-4">
                        {latestOtp ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold tracking-wider text-[#0B3D2E] bg-[#F2F7D9] px-2 py-0.5 rounded text-xs">
                              {latestOtp.code}
                            </span>
                            <button
                              onClick={() => copyToClipboard(latestOtp.code, u.id)}
                              className="p-1 text-[rgb(90,102,96)] hover:text-[#0B3D2E]"
                              title="Copy OTP"
                            >
                              {copiedId === u.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {latestOtp.is_consumed ? (
                              <span className="text-[10px] uppercase font-semibold text-[rgb(90,102,96)] bg-black/5 px-1.5 py-0.5 rounded">
                                Used
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                Active
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-[rgb(90,102,96)]">None</span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleReissueOtp(u.id, u.full_name)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-[#F2F7D9]/60 border border-[#14201A]/10 rounded-lg text-xs font-semibold text-[#0B3D2E] transition-colors shadow-xs cursor-pointer"
                        >
                          <Key className="w-3 h-3" /> Re-issue OTP
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="font-serif text-2xl text-[#0B3D2E] font-medium mb-1">
              Register New Subscriber
            </h2>
            <p className="text-xs text-[rgb(90,102,96)] mb-6">
              Creates the user profile and generates a single-use 6-digit OTP.
            </p>

            {modalSuccess ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-sm font-medium">
                  {modalSuccess}
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setModalSuccess(null);
                  }}
                  className="w-full py-3 bg-[#0B3D2E] text-[#F2F7D9] rounded-xl font-medium text-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Almaz Bekele"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+251911..."
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="user@urjifit.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                      Tier
                    </label>
                    <select
                      value={newTier}
                      onChange={(e) => setNewTier(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                    >
                      <option value="free">Free (Core)</option>
                      <option value="premium">Premium (AI)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                      Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                    >
                      <option value="active">Active</option>
                      <option value="trial">7-Day Trial</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-[#14201A]/10">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 bg-black/5 hover:bg-black/10 rounded-xl text-xs font-semibold text-[rgb(90,102,96)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9] rounded-xl text-xs font-semibold shadow-sm"
                  >
                    Generate Account & OTP
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
