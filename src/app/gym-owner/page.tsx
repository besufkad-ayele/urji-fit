'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  DollarSign,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import DataTable from '@/components/dashboard/DataTable';
import QuickActionButton from '@/components/dashboard/QuickActionButton';
import ThemeToggle from '@/components/ThemeToggle';
import { Class, Gym, GymMembership, GymStaff, User } from '@/types';

type GymOwnerUser = Pick<User, 'id' | 'full_name'> & { role: 'gym_owner' };

function isGymOwnerUser(value: unknown): value is GymOwnerUser {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'full_name' in value &&
    typeof value.full_name === 'string' &&
    'role' in value &&
    value.role === 'gym_owner'
  );
}

interface DashboardStats {
  totalMembers: number;
  totalStaff: number;
  totalClasses: number;
  todayAttendance: number;
  monthlyRevenue: number;
  expiringMemberships: number;
}

const DASHBOARD_SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'staff', label: 'Staff & trainers', icon: Dumbbell },
  { id: 'classes', label: 'Classes', icon: CalendarDays },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export default function GymOwnerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<GymOwnerUser | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [members, setMembers] = useState<GymMembership[]>([]);
  const [staff, setStaff] = useState<GymStaff[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [gymLoadError, setGymLoadError] = useState('');
  const [gymReload, setGymReload] = useState(0);

  // Check authentication and role
  useEffect(() => {
    const storedUser = localStorage.getItem('urji_user');
    if (!storedUser) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser: unknown = JSON.parse(storedUser);
      if (!isGymOwnerUser(parsedUser)) {
        alert('Access denied. Gym owner role required.');
        router.push('/dashboard');
        return;
      }
      // localStorage is browser-only, so authenticate after the initial render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(parsedUser);
    } catch {
      router.push('/login');
    }
  }, [router]);

  // Load the gym list after authenticating in the browser.
  useEffect(() => {
    if (!user) return;

    let isCurrentRequest = true;
    const loadGyms = async () => {
      try {
        const res = await fetch(`/api/gyms?userId=${user.id}&role=${user.role}`);
        const data = await res.json();
        if (!res.ok || !Array.isArray(data.gyms)) {
          throw new Error(data.error || 'Failed to load gyms.');
        }
        if (!isCurrentRequest) return;

        setGyms(data.gyms);
        setSelectedGym((currentGym) => currentGym ?? data.gyms[0] ?? null);
        if (data.gyms.length === 0) setLoading(false);
      } catch (error) {
        if (!isCurrentRequest) return;
        console.error('Failed to fetch gyms:', error);
        setGymLoadError('We could not load your gym information. Please try again.');
        setLoading(false);
      }
    };

    void loadGyms();
    return () => {
      isCurrentRequest = false;
    };
  }, [user, gymReload]);

  // Fetch gym statistics
  const fetchStats = useCallback(async (gymId: string) => {
    try {
      const res = await fetch(`/api/analytics/gym-stats?gymId=${gymId}`);
      const data = await res.json();
      if (res.ok && data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  // Fetch members
  const fetchMembers = useCallback(async (gymId: string) => {
    try {
      const res = await fetch(`/api/gyms/${gymId}/members`);
      const data = await res.json();
      if (res.ok && data.memberships) {
        setMembers(data.memberships);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  }, []);

  // Fetch staff
  const fetchStaff = useCallback(async (gymId: string) => {
    try {
      const res = await fetch(`/api/gyms/${gymId}/staff`);
      const data = await res.json();
      if (res.ok && data.staff) {
        setStaff(data.staff);
      }
    } catch (error) {
      console.error('Failed to fetch staff:', error);
    }
  }, []);

  // Fetch classes
  const fetchClasses = useCallback(async (gymId: string) => {
    try {
      const res = await fetch(`/api/gyms/${gymId}/classes`);
      const data = await res.json();
      if (res.ok && data.classes) {
        setClasses(data.classes);
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    }
  }, []);

  // Load all data when gym is selected
  useEffect(() => {
    if (selectedGym) {
      // These callbacks update state after their asynchronous API requests complete.
      Promise.all([
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchStats(selectedGym.id),
        fetchMembers(selectedGym.id),
        fetchStaff(selectedGym.id),
        fetchClasses(selectedGym.id),
      ]).finally(() => setLoading(false));
    }
  }, [selectedGym, fetchStats, fetchMembers, fetchStaff, fetchClasses]);

  const handleLogout = () => {
    localStorage.removeItem('urji_user');
    localStorage.removeItem('urji_user_id');
    router.replace('/login');
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3EFE5]">
        <div className="flex items-center gap-3 text-[#0B3D2E]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#0B3D2E]/20 border-t-[#0B3D2E]" />
          <p className="font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!selectedGym) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F3EFE5] p-5">
        <section className="w-full max-w-lg rounded-3xl border border-[#14201A]/10 bg-[#FCFAF6] p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2F7D9] text-[#0B3D2E]">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-3xl text-[#0B3D2E]">
            {gymLoadError ? 'Dashboard unavailable' : 'No gym connected yet'}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#5A6660]">
            {gymLoadError ||
              'Your gym has not been connected to this account. Ask your platform administrator to assign a gym, then come back here.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {gymLoadError && (
              <button
                type="button"
                onClick={() => {
                  setGymLoadError('');
                  setLoading(true);
                  setGymReload((current) => current + 1);
                }}
                className="rounded-xl bg-[#0B3D2E] px-4 py-2.5 text-sm font-semibold text-[#F2F7D9] transition-colors hover:bg-[#135440] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3D2E]"
              >
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-[#14201A]/10 bg-white px-4 py-2.5 text-sm font-semibold text-[#14201A] transition-colors hover:bg-[#F3EFE5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3D2E]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </section>
      </main>
    );
  }

  const memberColumns = [
    {
      key: 'member',
      label: 'Member',
      render: (item: GymMembership) => (
        <div>
          <div className="font-medium text-[#14201A]">{item.member?.full_name}</div>
          <div className="text-xs text-[rgb(90,102,96)]">{item.member?.email}</div>
        </div>
      ),
    },
    {
      key: 'membership_type',
      label: 'Type',
      render: (item: GymMembership) => (
        <span className="px-2 py-1 bg-[#F2F7D9] text-[#0B3D2E] rounded-full text-xs font-semibold uppercase">
          {item.membership_type}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: GymMembership) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
            item.status === 'active'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {item.status}
        </span>
      ),
    },
    {
      key: 'end_date',
      label: 'Expires',
      render: (item: GymMembership) =>
        item.end_date ? new Date(item.end_date).toLocaleDateString() : 'N/A',
    },
    {
      key: 'price',
      label: 'Price',
      render: (item: GymMembership) => `ETB ${item.price.toLocaleString()}`,
    },
  ];

  const staffColumns = [
    {
      key: 'user',
      label: 'Staff Member',
      render: (item: GymStaff) => (
        <div>
          <div className="font-medium text-[#14201A]">{item.user?.full_name}</div>
          <div className="text-xs text-[rgb(90,102,96)]">{item.user?.email}</div>
        </div>
      ),
    },
    {
      key: 'position',
      label: 'Position',
      render: (item: GymStaff) => (
        <span className="px-2 py-1 bg-[#0B3D2E] text-[#F2F7D9] rounded-full text-xs font-semibold uppercase">
          {item.position.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'hire_date',
      label: 'Hire Date',
      render: (item: GymStaff) => new Date(item.hire_date).toLocaleDateString(),
    },
    {
      key: 'hourly_rate',
      label: 'Rate',
      render: (item: GymStaff) =>
        item.hourly_rate ? `ETB ${item.hourly_rate}/hr` : item.salary ? `ETB ${item.salary}/mo` : 'N/A',
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: GymStaff) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
            item.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {item.status}
        </span>
      ),
    },
  ];

  const classColumns = [
    {
      key: 'name',
      label: 'Class Name',
      render: (item: Class) => (
        <div>
          <div className="font-medium text-[#14201A]">{item.name}</div>
          <div className="text-xs text-[rgb(90,102,96)] capitalize">{item.class_type}</div>
        </div>
      ),
    },
    {
      key: 'trainer',
      label: 'Trainer',
      render: (item: Class) => item.trainer?.full_name || 'Unassigned',
    },
    {
      key: 'schedule',
      label: 'Schedule',
      render: (item: Class) => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return `${days[item.day_of_week]} ${item.start_time}`;
      },
    },
    {
      key: 'capacity',
      label: 'Capacity',
      render: (item: Class) => `${item.capacity} people`,
    },
    {
      key: 'price',
      label: 'Price',
      render: (item: Class) => (item.price > 0 ? `ETB ${item.price}` : 'Included'),
    },
  ];

  const currentSection = DASHBOARD_SECTIONS.find((section) => section.id === activeTab);
  const sectionDescriptions: Record<string, string> = {
    overview: `Welcome back, ${user.full_name}. Here is what is happening at your gym today.`,
    members: 'Review memberships, renewal dates, and the people in your community.',
    staff: 'Keep track of your trainers and the people who keep your gym running.',
    classes: 'See the weekly class schedule, trainers, and available capacity.',
    analytics: 'A clear snapshot of activity and revenue for this location.',
  };
  const statCards: {
    title: string;
    value: string | number;
    detail: string;
    icon: LucideIcon;
    iconClass: string;
    target: string;
  }[] = [
    {
      title: 'Total members',
      value: stats?.totalMembers ?? '—',
      detail: stats ? `${stats.expiringMemberships} expiring soon` : 'Membership overview',
      icon: Users,
      iconClass: 'bg-[#F2F7D9] text-[#0B3D2E]',
      target: 'members',
    },
    {
      title: 'Staff members',
      value: stats?.totalStaff ?? '—',
      detail: 'Trainers and gym staff',
      icon: Dumbbell,
      iconClass: 'bg-[#FBE9E1] text-[#C1502E]',
      target: 'staff',
    },
    {
      title: 'Active classes',
      value: stats?.totalClasses ?? '—',
      detail: 'In the weekly schedule',
      icon: CalendarDays,
      iconClass: 'bg-[#E8F0EB] text-[#0B3D2E]',
      target: 'classes',
    },
    {
      title: 'Monthly revenue',
      value: stats ? `ETB ${stats.monthlyRevenue.toLocaleString()}` : '—',
      detail: 'Revenue this month',
      icon: TrendingUp,
      iconClass: 'bg-[#F2F7D9] text-[#0B3D2E]',
      target: 'analytics',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F3EFE5] text-[#14201A] lg:flex">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-[#14201A]/10 bg-[#FCFAF6] px-5 py-6 lg:flex">
        <div>
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B3D2E] text-[#F2F7D9]">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <p className="font-serif text-2xl leading-none text-[#0B3D2E]">Urji Fit</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5A6660]">
                Gym management
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-[#14201A]/10 bg-[#F3EFE5]/70 p-3">
            <p className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6660]">
              Your location
            </p>
            <div className="mt-2 flex items-center gap-2.5">
              <Building2 className="h-4 w-4 shrink-0 text-[#0B3D2E]" />
              <span className="truncate text-sm font-semibold text-[#14201A]">
                {selectedGym.name}
              </span>
            </div>
            {selectedGym.city && (
              <p className="mt-1 truncate pl-[26px] text-xs text-[#5A6660]">
                {selectedGym.city}
                {selectedGym.country ? `, ${selectedGym.country}` : ''}
              </p>
            )}
          </div>

          <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6660]">
            Workspace
          </p>
          <nav aria-label="Gym owner navigation" className="space-y-1">
            {DASHBOARD_SECTIONS.map((section) => {
              const Icon = section.icon;
              const selected = activeTab === section.id;
              const count =
                section.id === 'members'
                  ? members.length
                  : section.id === 'staff'
                    ? staff.length
                    : section.id === 'classes'
                      ? classes.length
                      : null;

              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={selected ? 'page' : undefined}
                  onClick={() => setActiveTab(section.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3D2E] ${
                    selected
                      ? 'bg-[#0B3D2E] text-[#F2F7D9] shadow-sm'
                      : 'text-[#5A6660] hover:bg-[#F2F7D9]/70 hover:text-[#14201A]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    {section.label}
                  </span>
                  {count !== null && (
                    <span
                      className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold ${
                        selected ? 'bg-[#F2F7D9] text-[#0B3D2E]' : 'bg-[#14201A]/5 text-[#5A6660]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto space-y-4 border-t border-[#14201A]/10 pt-5">
          <ThemeToggle variant="sidebar" />
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2F7D9] font-semibold text-[#0B3D2E]">
              {user.full_name?.trim().charAt(0).toUpperCase() || 'G'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.full_name}</p>
              <p className="text-xs text-[#5A6660]">Gym owner</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#5A6660] transition-colors hover:bg-[#FBE9E1] hover:text-[#C1502E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3D2E]"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-24 lg:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#14201A]/10 bg-[#FCFAF6]/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B3D2E] text-[#F2F7D9]">
              <Dumbbell className="h-4 w-4" />
            </div>
            <div>
              <p className="font-serif text-xl leading-none text-[#0B3D2E]">Urji Fit</p>
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-[#5A6660]">
                Gym management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle variant="icon" />
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-lg p-2 text-[#5A6660] transition-colors hover:bg-[#FBE9E1] hover:text-[#C1502E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3D2E]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] space-y-7 p-4 sm:p-6 lg:space-y-8 lg:p-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C1502E]">
                Gym operations
              </p>
              <h1 className="mt-1 font-serif text-3xl text-[#0B3D2E] sm:text-4xl">
                {currentSection?.label || 'Overview'}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5A6660]">
                {sectionDescriptions[activeTab]}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {gyms.length > 1 && (
                <label className="relative">
                  <span className="sr-only">Select gym location</span>
                  <select
                    value={selectedGym.id}
                    onChange={(event) => {
                      const nextGym = gyms.find((gym) => gym.id === event.target.value);
                      if (nextGym) {
                        setLoading(true);
                        setStats(null);
                        setMembers([]);
                        setStaff([]);
                        setClasses([]);
                        setSelectedGym(nextGym);
                      }
                    }}
                    className="max-w-[200px] appearance-none rounded-xl border border-[#14201A]/10 bg-[#FCFAF6] py-2.5 pl-3 pr-9 text-sm font-medium text-[#14201A] outline-none transition focus:border-[#0B3D2E]/40 focus:ring-2 focus:ring-[#0B3D2E]/10"
                  >
                    {gyms.map((gym) => (
                      <option key={gym.id} value={gym.id}>
                        {gym.name}
                      </option>
                    ))}
                  </select>
                  <Building2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A6660]" />
                </label>
              )}
              <div className="hidden sm:block lg:hidden">
                <ThemeToggle variant="pill" />
              </div>
            </div>
          </div>

          {activeTab === 'overview' && (
            <>
              <section className="relative overflow-hidden rounded-[28px] bg-[#0B3D2E] p-6 text-[#F3EFE5] shadow-sm sm:p-8">
                <div className="absolute -right-8 -top-16 h-56 w-56 rounded-full border border-white/10" />
                <div className="absolute -right-2 -top-10 h-44 w-44 rounded-full border border-white/10" />
                <div className="relative flex items-center justify-between gap-5">
                  <div className="max-w-2xl">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#F2F7D9]">
                      <Activity className="h-3.5 w-3.5" />
                      Location overview
                    </div>
                    <h2 className="font-serif text-3xl sm:text-4xl">{selectedGym.name}</h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
                      A quick look at your members, team, classes, and gym activity.
                    </p>
                    {(selectedGym.city || selectedGym.address) && (
                      <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-[#F2F7D9]/90">
                        <Building2 className="h-3.5 w-3.5" />
                        {[selectedGym.address, selectedGym.city].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-white/15 bg-white/10 sm:flex">
                    <Building2 className="h-9 w-9 text-[#F2F7D9]" />
                  </div>
                </div>
              </section>

              <section aria-label="Gym statistics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {statCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.title}
                      type="button"
                      onClick={() => setActiveTab(card.target)}
                      className="group rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#0B3D2E]/20 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3D2E]"
                    >
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconClass}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="mt-5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#5A6660]">
                        {card.title}
                      </span>
                      <span className="mt-1 block truncate font-serif text-3xl text-[#14201A]">
                        {card.value}
                      </span>
                      <span className="mt-1 block text-xs text-[#5A6660]">{card.detail}</span>
                    </button>
                  );
                })}
              </section>

              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-serif text-2xl text-[#14201A]">Manage your gym</h2>
                      <p className="mt-1 text-sm text-[#5A6660]">Jump to the areas you use most.</p>
                    </div>
                    <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-[#F2F7D9] text-[#0B3D2E] sm:flex">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <QuickActionButton
                      label="View members"
                      icon={Users}
                      onClick={() => setActiveTab('members')}
                      variant="primary"
                    />
                    <QuickActionButton
                      label="Manage staff"
                      icon={Dumbbell}
                      onClick={() => setActiveTab('staff')}
                      variant="secondary"
                    />
                    <QuickActionButton
                      label="View reports"
                      icon={BarChart3}
                      onClick={() => setActiveTab('analytics')}
                      variant="secondary"
                    />
                  </div>
                </section>

                <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2F7D9] text-[#0B3D2E]">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-serif text-2xl text-[#14201A]">Today at a glance</h2>
                      <p className="mt-0.5 text-xs text-[#5A6660]">Your location&apos;s latest snapshot</p>
                    </div>
                  </div>
                  <div className="divide-y divide-[#14201A]/10">
                    <div className="flex items-center justify-between py-3">
                      <span className="text-sm text-[#5A6660]">Member check-ins</span>
                      <span className="font-serif text-2xl text-[#0B3D2E]">
                        {stats?.todayAttendance ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <span className="text-sm text-[#5A6660]">Memberships expiring soon</span>
                      <span className="font-serif text-2xl text-[#C1502E]">
                        {stats?.expiringMemberships ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <span className="text-sm text-[#5A6660]">Classes on the schedule</span>
                      <span className="font-serif text-2xl text-[#0B3D2E]">
                        {stats?.totalClasses ?? classes.length}
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}

          {activeTab === 'members' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl text-[#14201A]">Gym members</h2>
                  <p className="mt-1 text-sm text-[#5A6660]">
                    Membership status and renewal information for this location.
                  </p>
                </div>
                <span className="rounded-full bg-[#F2F7D9] px-3 py-1.5 text-xs font-semibold text-[#0B3D2E]">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </span>
              </div>
              <DataTable
                columns={memberColumns}
                data={members}
                keyExtractor={(item) => item.id}
                emptyMessage="No members have been added to this gym yet."
              />
            </section>
          )}

          {activeTab === 'staff' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl text-[#14201A]">Staff & trainers</h2>
                  <p className="mt-1 text-sm text-[#5A6660]">
                    Your gym team and their current work status.
                  </p>
                </div>
                <span className="rounded-full bg-[#F2F7D9] px-3 py-1.5 text-xs font-semibold text-[#0B3D2E]">
                  {staff.length} {staff.length === 1 ? 'team member' : 'team members'}
                </span>
              </div>
              <DataTable
                columns={staffColumns}
                data={staff}
                keyExtractor={(item) => item.id}
                emptyMessage="No staff members have been added to this gym yet."
              />
            </section>
          )}

          {activeTab === 'classes' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl text-[#14201A]">Class schedule</h2>
                  <p className="mt-1 text-sm text-[#5A6660]">
                    Weekly sessions, assigned trainers, and class capacity.
                  </p>
                </div>
                <span className="rounded-full bg-[#F2F7D9] px-3 py-1.5 text-xs font-semibold text-[#0B3D2E]">
                  {classes.length} {classes.length === 1 ? 'class' : 'classes'}
                </span>
              </div>
              <DataTable
                columns={classColumns}
                data={classes}
                keyExtractor={(item) => item.id}
                emptyMessage="No classes are scheduled for this gym yet."
              />
            </section>
          )}

          {activeTab === 'analytics' && (
            <section className="space-y-5">
              <div>
                <h2 className="font-serif text-2xl text-[#14201A]">Performance snapshot</h2>
                <p className="mt-1 text-sm text-[#5A6660]">
                  Current operating metrics for {selectedGym.name}.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  {
                    label: 'Member check-ins today',
                    value: stats?.todayAttendance ?? '—',
                    icon: ClipboardList,
                  },
                  {
                    label: 'Monthly revenue',
                    value: stats ? `ETB ${stats.monthlyRevenue.toLocaleString()}` : '—',
                    icon: DollarSign,
                  },
                  {
                    label: 'Memberships expiring soon',
                    value: stats?.expiringMemberships ?? '—',
                    icon: TrendingUp,
                  },
                ].map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div
                      key={metric.label}
                      className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5A6660]">
                          {metric.label}
                        </p>
                        <Icon className="h-5 w-5 shrink-0 text-[#0B3D2E]" />
                      </div>
                      <p className="mt-5 font-serif text-3xl text-[#14201A]">{metric.value}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      <nav
        aria-label="Gym owner navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[#14201A]/10 bg-[#FCFAF6]/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-md lg:hidden"
      >
        {DASHBOARD_SECTIONS.map((section) => {
          const Icon = section.icon;
          const selected = activeTab === section.id;
          return (
            <button
              key={section.id}
              type="button"
              aria-current={selected ? 'page' : undefined}
              onClick={() => setActiveTab(section.id)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1.5 text-[9px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#0B3D2E] ${
                selected ? 'text-[#0B3D2E]' : 'text-[#5A6660]'
              }`}
            >
              <span className={`rounded-full p-1 ${selected ? 'bg-[#F2F7D9]' : ''}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate">{section.id === 'staff' ? 'Staff' : section.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
