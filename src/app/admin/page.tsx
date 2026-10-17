'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  ShieldCheck,
  UserPlus,
  RefreshCw,
  Key,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Building2,
  Dumbbell,
  TrendingUp,
  LayoutDashboard,
  Settings,
  BarChart3,
  LogOut,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import TabNavigation from '@/components/dashboard/TabNavigation';
import StatsCard from '@/components/dashboard/StatsCard';
import DataTable from '@/components/dashboard/DataTable';
import PageHeader from '@/components/dashboard/PageHeader';
import QuickActionButton from '@/components/dashboard/QuickActionButton';
import { Gym } from '@/types';

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
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [newTier, setNewTier] = useState('free');
  const [newStatus, setNewStatus] = useState('active');
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [reissuedOtpInfo, setReissuedOtpInfo] = useState<{ userName: string; code: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const fetchGyms = useCallback(async () => {
    try {
      const raw = localStorage.getItem('urji_user');
      if (!raw) return;
      const currentUser = JSON.parse(raw);
      
      const res = await fetch(`/api/gyms?userId=${currentUser.id}&role=${currentUser.role}`);
      const data = await res.json();
      if (res.ok && data.gyms) {
        setGyms(data.gyms);
      }
    } catch {
      console.error('Failed to fetch gyms');
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('urji_user');
    if (!raw) {
      router.push('/login');
      return;
    }
    try {
      const parsedUser = JSON.parse(raw);
      if (parsedUser.role !== 'admin' && parsedUser.role !== 'platform_admin') {
        alert('Access denied. Admin role required.');
        router.push('/dashboard');
        return;
      }
      setUser(parsedUser);
    } catch {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchUsers();
      fetchGyms();
    }
  }, [user, fetchUsers, fetchGyms]);

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
          role: newRole,
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
        fetchUsers();
      } else {
        alert(data.error || 'Failed to re-issue OTP');
      }
    } catch {
      alert('Error re-issuing OTP');
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

  const handleLogout = () => {
    localStorage.removeItem('urji_user');
    localStorage.removeItem('urji_user_id');
    router.push('/login');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F3EFE5]">
        <p className="font-serif text-2xl text-[#0B3D2E]">Loading Admin Dashboard...</p>
      </div>
    );
  }

  const activeCount = users.filter((u) => u.subscription_status === 'active').length;
  const boundCount = users.filter((u) => u.current_device_id).length;
  const gymOwnerCount = users.filter((u) => u.role === 'gym_owner').length;
  const trainerCount = users.filter((u) => u.role === 'trainer').length;

  const navItems = [
    { label: 'Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'Users', href: '/admin', icon: Users },
    { label: 'Gyms', href: '/admin', icon: Building2 },
    { label: 'Analytics', href: '/admin', icon: BarChart3 },
    { label: 'Settings', href: '/admin', icon: Settings },
  ];

  const userColumns = [
    {
      key: 'user',
      label: 'User',
      render: (item: AdminUser) => (
        <div>
          <div className="font-medium text-[#14201A]">{item.full_name}</div>
          <div className="text-xs text-[rgb(90,102,96)]">{item.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (item: AdminUser) => (
        <span className="px-2 py-1 bg-[#0B3D2E] text-[#F2F7D9] rounded-full text-xs font-semibold uppercase">
          {item.role.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'tier',
      label: 'Tier',
      render: (item: AdminUser) => (
        <button
          onClick={() => handleToggleTier(item.id, item.tier)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide transition-all ${
            item.tier === 'premium'
              ? 'bg-[#F2F7D9] text-[#0B3D2E] border border-[#0B3D2E]/20'
              : 'bg-black/5 text-[rgb(90,102,96)]'
          }`}
        >
          {item.tier === 'premium' ? (
            <ToggleRight className="w-4 h-4 text-[#0B3D2E]" />
          ) : (
            <ToggleLeft className="w-4 h-4 text-[rgb(90,102,96)]" />
          )}
          {item.tier}
        </button>
      ),
    },
    {
      key: 'device',
      label: 'Device',
      render: (item: AdminUser) =>
        item.current_device_id ? (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Bound
          </span>
        ) : (
          <span className="text-xs text-[rgb(90,102,96)]">Unlocked</span>
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: AdminUser) => (
        <button
          onClick={() => handleReissueOtp(item.id, item.full_name)}
          className="px-3 py-1.5 bg-white hover:bg-[#F2F7D9]/60 border border-[#14201A]/10 rounded-lg text-xs font-semibold text-[#0B3D2E]"
        >
          <Key className="w-3 h-3 inline mr-1" /> Re-issue OTP
        </button>
      ),
    },
  ];

  const gymColumns = [
    {
      key: 'name',
      label: 'Gym Name',
      render: (item: Gym) => (
        <div>
          <div className="font-medium text-[#14201A]">{item.name}</div>
          <div className="text-xs text-[rgb(90,102,96)]">{item.city}</div>
        </div>
      ),
    },
    {
      key: 'owner',
      label: 'Owner',
      render: (item: Gym) => item.owner?.full_name || 'N/A',
    },
    {
      key: 'capacity',
      label: 'Capacity',
    },
    {
      key: 'monthly_revenue',
      label: 'Revenue',
      render: (item: Gym) => `ETB ${item.monthly_revenue.toLocaleString()}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: Gym) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
            item.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {item.status}
        </span>
      ),
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#F3EFE5]">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#FCFAF6] border-r border-[#14201A]/10 p-5 sticky top-0 h-screen z-30">
        <div>
          {/* Brand header */}
          <div className="flex items-center gap-3 pb-6 mb-6 border-b border-[#14201A]/10">
            <div className="w-10 h-10 rounded-xl bg-[#0B3D2E] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-[#F2F7D9]" />
            </div>
            <div>
              <h1 className="font-serif text-xl leading-none text-[#0B3D2E] font-medium">
                Admin
              </h1>
              <p className="text-[10px] font-medium uppercase tracking-widest text-[rgb(90,102,96)] mt-0.5">
                Platform Control
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    if (item.label === 'Overview') setActiveTab('overview');
                    else if (item.label === 'Users') setActiveTab('users');
                    else if (item.label === 'Gyms') setActiveTab('gyms');
                    else if (item.label === 'Analytics') setActiveTab('analytics');
                    else if (item.label === 'Settings') alert('Settings coming soon');
                  }}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    (item.label === 'Overview' && activeTab === 'overview') ||
                    (item.label === 'Users' && activeTab === 'users') ||
                    (item.label === 'Gyms' && activeTab === 'gyms') ||
                    (item.label === 'Analytics' && activeTab === 'analytics')
                      ? 'bg-[#0B3D2E] text-[#F2F7D9] shadow-sm font-semibold'
                      : 'text-[rgb(90,102,96)] hover:bg-[#F2F7D9]/60 hover:text-[#14201A]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile & logout */}
        <div className="mt-auto pt-4 border-t border-[#14201A]/10 space-y-3">
          <ThemeToggle variant="sidebar" />

          <div className="flex items-center justify-between px-1">
            <div className="truncate mr-2">
              <p className="text-sm font-semibold text-[#14201A] truncate">
                {user.full_name}
              </p>
              <p className="text-xs text-[rgb(90,102,96)] truncate">Platform Admin</p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-2 text-[rgb(90,102,96)] hover:text-[#C1502E] hover:bg-black/5 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-5 md:p-10 pb-24 md:pb-10">
        <div className="max-w-7xl mx-auto space-y-8">
          <PageHeader
            badge="Platform Administration"
            title="System Dashboard"
            subtitle="Manage users, gyms, and platform-wide operations"
            actions={
              <>
                <ThemeToggle variant="pill" />
                <QuickActionButton
                  label="Register User"
                  icon={UserPlus}
                  onClick={() => {
                    setShowModal(true);
                    setModalSuccess(null);
                  }}
                  variant="primary"
                />
              </>
            }
          />

          {/* Re-issued OTP Notification Banner */}
          {reissuedOtpInfo && (
            <div className="p-4 bg-[#F2F7D9] border border-[#0B3D2E]/20 rounded-2xl flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0B3D2E] flex items-center justify-center">
                  <Key className="w-5 h-5 text-[#F2F7D9]" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#0B3D2E] uppercase tracking-wider">
                    Fresh OTP for {reissuedOtpInfo.userName}
                  </div>
                  <div className="font-mono font-bold text-2xl text-[#0B3D2E] tracking-widest">
                    {reissuedOtpInfo.code}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(reissuedOtpInfo.code, 'banner')}
                  className="px-3 py-2 bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9] rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  {copiedId === 'banner' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedId === 'banner' ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={() => setReissuedOtpInfo(null)}
                  className="p-2 text-[#0B3D2E]/60 hover:text-[#0B3D2E] rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatsCard
              title="Total Gyms"
              value={gyms.length}
              subtitle="Active facilities"
              icon={Building2}
              iconColor="text-[#0B3D2E]"
              onClick={() => setActiveTab('gyms')}
            />
            <StatsCard
              title="Gym Owners"
              value={gymOwnerCount}
              subtitle="Facility managers"
              icon={ShieldCheck}
              iconColor="text-[#C1502E]"
            />
            <StatsCard
              title="Trainers"
              value={trainerCount}
              subtitle="Active coaches"
              icon={Dumbbell}
              iconColor="text-sky-600"
            />
            <StatsCard
              title="Total Users"
              value={users.length}
              subtitle={`${activeCount} active`}
              icon={Users}
              iconColor="text-emerald-600"
            />
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-6">
                <h3 className="font-serif text-xl text-[#14201A] mb-4">Platform Stats</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[rgb(90,102,96)]">Total Users</span>
                    <span className="text-2xl font-serif text-[#0B3D2E]">{users.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[rgb(90,102,96)]">Active Devices</span>
                    <span className="text-2xl font-serif text-[#0B3D2E]">{boundCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[rgb(90,102,96)]">Total Gyms</span>
                    <span className="text-2xl font-serif text-[#0B3D2E]">{gyms.length}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-6">
                <h3 className="font-serif text-xl text-[#14201A] mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <QuickActionButton
                    label="Register New User"
                    icon={UserPlus}
                    onClick={() => setShowModal(true)}
                    variant="primary"
                  />
                  <QuickActionButton
                    label="View All Users"
                    icon={Users}
                    onClick={() => setActiveTab('users')}
                    variant="secondary"
                  />
                  <QuickActionButton
                    label="View All Gyms"
                    icon={Building2}
                    onClick={() => setActiveTab('gyms')}
                    variant="secondary"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-serif text-2xl text-[#14201A]">All Users</h3>
                <button
                  onClick={fetchUsers}
                  className="p-2 text-[rgb(90,102,96)] hover:text-[#0B3D2E] hover:bg-black/5 rounded-lg"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <DataTable
                columns={userColumns}
                data={users}
                keyExtractor={(item) => item.id}
                emptyMessage="No users found"
              />
            </div>
          )}

          {activeTab === 'gyms' && (
            <div className="space-y-4">
              <h3 className="font-serif text-2xl text-[#14201A]">All Gyms</h3>
              <DataTable
                columns={gymColumns}
                data={gyms}
                keyExtractor={(item) => item.id}
                emptyMessage="No gyms registered yet"
              />
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-12 text-center">
              <TrendingUp className="w-16 h-16 text-[rgb(90,102,96)] mx-auto mb-4" />
              <h3 className="font-serif text-2xl text-[#14201A] mb-2">Platform Analytics</h3>
              <p className="text-[rgb(90,102,96)] mb-6">System-wide insights and metrics</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
                <div className="p-4 bg-white rounded-xl">
                  <div className="text-2xl font-serif text-[#0B3D2E] mb-1">{users.length}</div>
                  <div className="text-xs text-[rgb(90,102,96)]">Total Users</div>
                </div>
                <div className="p-4 bg-white rounded-xl">
                  <div className="text-2xl font-serif text-[#0B3D2E] mb-1">{gyms.length}</div>
                  <div className="text-xs text-[rgb(90,102,96)]">Total Gyms</div>
                </div>
                <div className="p-4 bg-white rounded-xl">
                  <div className="text-2xl font-serif text-[#0B3D2E] mb-1">{boundCount}</div>
                  <div className="text-xs text-[rgb(90,102,96)]">Active Devices</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="font-serif text-2xl text-[#0B3D2E] font-medium mb-1">
              Register New User
            </h2>
            <p className="text-xs text-[rgb(90,102,96)] mb-6">
              Creates user profile and generates a single-use OTP
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
                      Role
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                    >
                      <option value="member">Member</option>
                      <option value="trainer">Trainer</option>
                      <option value="gym_owner">Gym Owner</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                      Tier
                    </label>
                    <select
                      value={newTier}
                      onChange={(e) => setNewTier(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                    >
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
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
                    Create User
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
