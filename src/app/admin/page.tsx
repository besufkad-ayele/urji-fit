'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  ShieldCheck,
  AlertCircle,
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
  const [gymsLoading, setGymsLoading] = useState(true);
  const [gymLoadError, setGymLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('member');
  const [newHomeGymId, setNewHomeGymId] = useState('');
  const [newTier, setNewTier] = useState('free');
  const [newStatus, setNewStatus] = useState('active');
  const [newGymName, setNewGymName] = useState('');
  const [newGymOwnerId, setNewGymOwnerId] = useState('');
  const [newGymCity, setNewGymCity] = useState('');
  const [assignmentGymId, setAssignmentGymId] = useState('');
  const [assignmentOwnerId, setAssignmentOwnerId] = useState('');
  const [gymError, setGymError] = useState('');
  const [creatingGym, setCreatingGym] = useState(false);
  const [adminPasswordConfigured, setAdminPasswordConfigured] = useState<boolean | null>(null);
  const [adminPasswordStatusChecked, setAdminPasswordStatusChecked] = useState(false);
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [userCreateError, setUserCreateError] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
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
    setGymsLoading(true);
    setGymLoadError('');
    try {
      const raw = localStorage.getItem('urji_user');
      if (!raw) throw new Error('Your admin session is unavailable. Sign in again to load gyms.');
      const currentUser = JSON.parse(raw);
      
      const res = await fetch(`/api/gyms?userId=${currentUser.id}&role=${currentUser.role}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load gyms.');
      if (!Array.isArray(data.gyms)) throw new Error('The gym list could not be loaded.');
      setGyms(data.gyms);
    } catch (error) {
      setGymLoadError(error instanceof Error ? error.message : 'Could not load gyms.');
    } finally {
      setGymsLoading(false);
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
      void fetch('/api/auth/admin-password')
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Could not check password setup.');
          setAdminPasswordConfigured(Boolean(data.passwordConfigured));
        })
        .catch((error: unknown) => {
          setPasswordError(error instanceof Error ? error.message : 'Could not check password setup.');
        })
        .finally(() => {
          setAdminPasswordStatusChecked(true);
        });
    }
  }, [user, fetchUsers, fetchGyms]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setUserCreateError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newName,
          phone: newPhone || null,
          email: newEmail || null,
          role: newRole,
          home_gym_id: newRole === 'member' ? newHomeGymId : null,
          tier: newTier,
          subscription_status: newStatus,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const gymName = gyms.find((gym) => gym.id === newHomeGymId)?.name;
        setModalSuccess(
          `User created${newRole === 'member' && gymName ? ` and assigned to ${gymName}` : ''}! Generated 6-digit OTP: ${data.otp.code}`
        );
        fetchUsers();
        setNewName('');
        setNewPhone('');
        setNewEmail('');
        setNewHomeGymId('');
      } else {
        setUserCreateError(data.error || 'We couldn’t create the user. Please review the details and try again.');
      }
    } catch (error) {
      setUserCreateError(
        error instanceof Error
          ? `We couldn’t reach the server: ${error.message}`
          : 'We couldn’t reach the server. Check your connection and try again.'
      );
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreateGym = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingGym(true);
    setGymError('');

    try {
      const res = await fetch('/api/gyms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGymName.trim(),
          owner_id: newGymOwnerId,
          city: newGymCity.trim() || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setGymError(data.error || 'Failed to create gym.');
        return;
      }

      setNewGymName('');
      setNewGymOwnerId('');
      setNewGymCity('');
      await fetchGyms();
    } catch {
      setGymError('Network error creating gym.');
    } finally {
      setCreatingGym(false);
    }
  };

  const handleAssignGymOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    const gym = gyms.find((item) => item.id === assignmentGymId);
    const owner = users.find((item) => item.id === assignmentOwnerId);
    if (!gym || !owner) {
      setGymError('Select an existing gym and a gym-owner account.');
      return;
    }
    if (
      gym.owner_id !== assignmentOwnerId &&
      !window.confirm(`Assign ${gym.name} to ${owner.full_name}? The current owner will lose access to this gym.`)
    ) {
      return;
    }

    setCreatingGym(true);
    setGymError('');
    try {
      const res = await fetch('/api/gyms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gymId: assignmentGymId, owner_id: assignmentOwnerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGymError(data.error || 'Failed to assign gym owner.');
        return;
      }
      await fetchGyms();
    } catch {
      setGymError('Network error assigning gym owner.');
    } finally {
      setCreatingGym(false);
    }
  };

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage('');
    setPasswordError('');
    if (newAdminPassword !== confirmAdminPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/auth/admin-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentAdminPassword,
          newPassword: newAdminPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || 'Could not change administrator password.');
        return;
      }
      setAdminPasswordConfigured(true);
      setCurrentAdminPassword('');
      setNewAdminPassword('');
      setConfirmAdminPassword('');
      setPasswordMessage(data.message || 'Administrator password updated.');
    } catch {
      setPasswordError('Network error changing administrator password.');
    } finally {
      setChangingPassword(false);
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
    void fetch('/api/auth/logout', { method: 'POST' });
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
                    else if (item.label === 'Settings') setActiveTab('settings');
                  }}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    (item.label === 'Overview' && activeTab === 'overview') ||
                    (item.label === 'Users' && activeTab === 'users') ||
                    (item.label === 'Gyms' && activeTab === 'gyms') ||
                    (item.label === 'Analytics' && activeTab === 'analytics') ||
                    (item.label === 'Settings' && activeTab === 'settings')
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
                    setUserCreateError('');
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
                    onClick={() => {
                      setShowModal(true);
                      setModalSuccess(null);
                      setUserCreateError('');
                    }}
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
              {gyms.length > 0 && users.some((item) => item.role === 'gym_owner') && (
                <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 md:p-6">
                  <h3 className="font-serif text-2xl text-[#14201A]">Assign an existing gym</h3>
                  <p className="mt-1 text-sm text-[rgb(90,102,96)]">
                    Use this if the gym is already listed below. Reassignment transfers dashboard access from its current owner.
                  </p>
                  <form onSubmit={handleAssignGymOwner} className="mt-5 grid gap-3 md:grid-cols-3">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)]">
                      Gym
                      <select
                        required
                        value={assignmentGymId}
                        onChange={(event) => setAssignmentGymId(event.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3.5 py-2.5 text-sm font-normal normal-case tracking-normal text-[#14201A]"
                      >
                        <option value="">Select a gym</option>
                        {gyms.map((gym) => (
                          <option key={gym.id} value={gym.id}>
                            {gym.name} {gym.owner?.full_name ? `— ${gym.owner.full_name}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)]">
                      New owner
                      <select
                        required
                        value={assignmentOwnerId}
                        onChange={(event) => setAssignmentOwnerId(event.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3.5 py-2.5 text-sm font-normal normal-case tracking-normal text-[#14201A]"
                      >
                        <option value="">Select an owner</option>
                        {users
                          .filter((item) => item.role === 'gym_owner')
                          .map((owner) => (
                            <option key={owner.id} value={owner.id}>
                              {owner.full_name} ({owner.email || owner.phone})
                            </option>
                          ))}
                      </select>
                    </label>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={creatingGym}
                        className="w-full rounded-xl bg-[#0B3D2E] px-4 py-2.5 text-sm font-semibold text-[#F2F7D9] transition-colors hover:bg-[#135440] disabled:opacity-50"
                      >
                        {creatingGym ? 'Assigning…' : 'Assign owner'}
                      </button>
                    </div>
                    {gymError && (
                      <p role="alert" className="text-sm text-red-700 md:col-span-3">
                        {gymError}
                      </p>
                    )}
                  </form>
                </section>
              )}
              <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 md:p-6">
                <h3 className="font-serif text-2xl text-[#14201A]">Create a gym</h3>
                <p className="mt-1 text-sm text-[rgb(90,102,96)]">
                  Connect a gym to an existing gym-owner account so the owner can access its dashboard.
                </p>
                {users.filter((item) => item.role === 'gym_owner').length > 0 ? (
                  <form onSubmit={handleCreateGym} className="mt-5 grid gap-3 md:grid-cols-3">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)]">
                      Gym name
                      <input
                        required
                        value={newGymName}
                        onChange={(event) => setNewGymName(event.target.value)}
                        placeholder="e.g. Bole Urji Gym"
                        className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3.5 py-2.5 text-sm font-normal normal-case tracking-normal text-[#14201A]"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)]">
                      Gym owner
                      <select
                        required
                        value={newGymOwnerId}
                        onChange={(event) => setNewGymOwnerId(event.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3.5 py-2.5 text-sm font-normal normal-case tracking-normal text-[#14201A]"
                      >
                        <option value="">Select an owner</option>
                        {users
                          .filter((item) => item.role === 'gym_owner')
                          .map((owner) => (
                            <option key={owner.id} value={owner.id}>
                              {owner.full_name} ({owner.email || owner.phone})
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)]">
                      City <span className="font-normal normal-case tracking-normal">(optional)</span>
                      <input
                        value={newGymCity}
                        onChange={(event) => setNewGymCity(event.target.value)}
                        placeholder="e.g. Addis Ababa"
                        className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3.5 py-2.5 text-sm font-normal normal-case tracking-normal text-[#14201A]"
                      />
                    </label>
                    {gymError && (
                      <p role="alert" className="text-sm text-red-700 md:col-span-3">
                        {gymError}
                      </p>
                    )}
                    <div className="md:col-span-3">
                      <button
                        type="submit"
                        disabled={creatingGym}
                        className="rounded-xl bg-[#0B3D2E] px-4 py-2.5 text-sm font-semibold text-[#F2F7D9] transition-colors hover:bg-[#135440] disabled:opacity-50"
                      >
                        {creatingGym ? 'Creating gym…' : 'Create gym and assign owner'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-4 text-sm text-[rgb(90,102,96)]">
                    Register a user with the Gym Owner role first, then return here to connect their gym.
                  </p>
                )}
              </section>
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

          {activeTab === 'settings' && (
            <section className="max-w-2xl rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 md:p-6">
              <h3 className="font-serif text-2xl text-[#14201A]">Administrator security</h3>
              <p className="mt-1 text-sm text-[rgb(90,102,96)]">
                {adminPasswordConfigured
                  ? 'Change the password used for platform-admin sign-in. Use at least 12 characters.'
                : adminPasswordStatusChecked
                  ? 'Set a password for future administrator sign-ins. You are currently signed in with your admin account, so you do not need to enter a current password.'
                  : 'Checking administrator password setup…'}
              </p>
              <form onSubmit={handleChangeAdminPassword} className="mt-5 space-y-4">
                {adminPasswordConfigured && (
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)]">
                    Current password
                    <input
                      required
                      type="password"
                      autoComplete="current-password"
                      value={currentAdminPassword}
                      onChange={(event) => setCurrentAdminPassword(event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3.5 py-2.5 text-sm font-normal normal-case tracking-normal text-[#14201A]"
                    />
                  </label>
                )}
                <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)]">
                  New password
                  <input
                    required
                    minLength={12}
                    maxLength={128}
                    type="password"
                    autoComplete="new-password"
                    value={newAdminPassword}
                    onChange={(event) => setNewAdminPassword(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3.5 py-2.5 text-sm font-normal normal-case tracking-normal text-[#14201A]"
                  />
                </label>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)]">
                  Confirm new password
                  <input
                    required
                    minLength={12}
                    maxLength={128}
                    type="password"
                    autoComplete="new-password"
                    value={confirmAdminPassword}
                    onChange={(event) => setConfirmAdminPassword(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#14201A]/15 bg-white px-3.5 py-2.5 text-sm font-normal normal-case tracking-normal text-[#14201A]"
                  />
                </label>
                {passwordError && <p role="alert" className="text-sm text-red-700">{passwordError}</p>}
                {passwordMessage && <p role="status" className="text-sm text-emerald-800">{passwordMessage}</p>}
                <button
                  type="submit"
                  disabled={changingPassword || !adminPasswordStatusChecked || adminPasswordConfigured === null}
                  className="rounded-xl bg-[#0B3D2E] px-4 py-2.5 text-sm font-semibold text-[#F2F7D9] transition-colors hover:bg-[#135440] disabled:opacity-50"
                >
                  {changingPassword
                    ? adminPasswordConfigured ? 'Updating password…' : 'Setting password…'
                    : !adminPasswordStatusChecked || adminPasswordConfigured === null
                      ? 'Checking password…'
                      : adminPasswordConfigured ? 'Update password' : 'Set admin password'}
                </button>
              </form>
            </section>
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
                {userCreateError && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 rounded-2xl border border-[#C1502E]/20 bg-[#FBE9E1] p-4 text-sm text-[#8E341E]"
                  >
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-semibold">We couldn’t create this account</p>
                      <p className="mt-1 leading-relaxed">{userCreateError}</p>
                    </div>
                  </div>
                )}
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
                      onChange={(e) => {
                        setNewRole(e.target.value);
                        if (e.target.value !== 'member') setNewHomeGymId('');
                      }}
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

                {newRole === 'member' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                      Gym
                    </label>
                    <select
                      required
                      value={newHomeGymId}
                      disabled={gymsLoading || Boolean(gymLoadError)}
                      onChange={(e) => {
                        setNewHomeGymId(e.target.value);
                        setUserCreateError('');
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                    >
                      <option value="">{gymsLoading ? 'Loading gyms…' : 'Select a gym'}</option>
                      {gyms
                        .filter((gym) => gym.status === 'active')
                        .map((gym) => (
                          <option key={gym.id} value={gym.id}>
                            {gym.name}{gym.city ? ` — ${gym.city}` : ''}
                          </option>
                        ))}
                    </select>
                    {gymLoadError ? (
                      <p role="alert" className="mt-1 text-xs text-[#C1502E]">{gymLoadError}</p>
                    ) : !gymsLoading && gyms.every((gym) => gym.status !== 'active') ? (
                      <p className="mt-1 text-xs text-[#C1502E]">
                        Create or activate a gym before registering a member.
                      </p>
                    ) : null}
                  </div>
                )}

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
                    disabled={creatingUser || (newRole === 'member' && (
                      gymsLoading ||
                      Boolean(gymLoadError) ||
                      !newHomeGymId ||
                      gyms.every((gym) => gym.status !== 'active')
                    ))}
                    className="flex-1 py-2.5 bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9] rounded-xl text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creatingUser ? 'Creating account…' : 'Create User'}
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
