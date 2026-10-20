'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  NotebookPen,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import DataTable from '@/components/dashboard/DataTable';
import QuickActionButton from '@/components/dashboard/QuickActionButton';
import Modal from '@/components/dashboard/Modal';
import ThemeToggle from '@/components/ThemeToggle';
import { ProgressNote, TrainerAssignment, User } from '@/types';

type TrainerUser = Pick<User, 'id' | 'full_name'> & { role: 'trainer' };
type ProgressNoteType = NonNullable<ProgressNote['note_type']>;

function isTrainerUser(value: unknown): value is TrainerUser {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'full_name' in value &&
    typeof value.full_name === 'string' &&
    'role' in value &&
    value.role === 'trainer'
  );
}

const TRAINER_SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'clients', label: 'My clients', icon: Users },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'progress', label: 'Progress notes', icon: NotebookPen },
];
const PROGRESS_NOTE_TYPES: ProgressNoteType[] = [
  'general',
  'assessment',
  'progress',
  'injury',
  'goal_update',
];

export default function TrainerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<TrainerUser | null>(null);
  const [clients, setClients] = useState<TrainerAssignment[]>([]);
  const [selectedClient, setSelectedClient] = useState<TrainerAssignment | null>(null);
  const [progressNotes, setProgressNotes] = useState<ProgressNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<ProgressNoteType>('general');
  const [clientLoadError, setClientLoadError] = useState('');
  const [progressNoteError, setProgressNoteError] = useState('');
  const [saveNoteLoading, setSaveNoteLoading] = useState(false);
  const [clientReload, setClientReload] = useState(0);

  // Check authentication and role
  useEffect(() => {
    const storedUser = localStorage.getItem('urji_user');
    if (!storedUser) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser: unknown = JSON.parse(storedUser);
      if (!isTrainerUser(parsedUser)) {
        alert('Access denied. Trainer role required.');
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

  // Fetch progress notes for a client
  const fetchProgressNotes = useCallback(async (clientId: string) => {
    if (!user) return;

    try {
      const res = await fetch(`/api/trainer/progress-notes?clientId=${clientId}&trainerId=${user.id}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.notes)) {
        throw new Error(data.error || 'Failed to load progress notes.');
      }
      setProgressNotes(data.notes);
      setProgressNoteError('');
    } catch (error) {
      console.error('Failed to fetch progress notes:', error);
      setProgressNoteError('We could not load progress notes for this client.');
    }
  }, [user]);

  // Add progress note
  const handleAddNote = async () => {
    if (!selectedClient || !user || !noteContent.trim()) return;

    setSaveNoteLoading(true);
    try {
      const res = await fetch('/api/trainer/progress-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainer_id: user.id,
          client_id: selectedClient.client_id,
          gym_id: selectedClient.gym_id,
          note_type: noteType,
          content: noteContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save progress note.');
      }

      setShowNoteModal(false);
      setNoteContent('');
      await fetchProgressNotes(selectedClient.client_id);
      alert('Progress note added successfully!');
    } catch (error) {
      console.error('Failed to add note:', error);
      alert(error instanceof Error ? error.message : 'Failed to save progress note.');
    } finally {
      setSaveNoteLoading(false);
    }
  };

  // Fetch trainer assignments after authenticating in the browser.
  useEffect(() => {
    if (!user) return;

    let isCurrentRequest = true;
    const loadClients = async () => {
      try {
        const res = await fetch(`/api/trainer/clients?trainerId=${user.id}`);
        const data = await res.json();
        if (!res.ok || !Array.isArray(data.assignments)) {
          throw new Error(data.error || 'Failed to load assigned clients.');
        }
        if (!isCurrentRequest) return;

        setClients(data.assignments);
        setSelectedClient(data.assignments[0] ?? null);
        if (data.assignments.length === 0) setProgressNotes([]);
        setClientLoadError('');
      } catch (error) {
        if (!isCurrentRequest) return;
        console.error('Failed to fetch clients:', error);
        setClientLoadError('We could not load your client list. Please try again.');
      } finally {
        if (isCurrentRequest) setLoading(false);
      }
    };

    void loadClients();
    return () => {
      isCurrentRequest = false;
    };
  }, [user, clientReload]);

  useEffect(() => {
    if (selectedClient) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchProgressNotes(selectedClient.client_id);
    }
  }, [selectedClient, fetchProgressNotes]);

  const handleLogout = () => {
    void fetch('/api/auth/logout', { method: 'POST' });
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

  const clientColumns = [
    {
      key: 'client',
      label: 'Client',
      render: (item: TrainerAssignment) => (
        <div>
          <div className="font-medium text-[#14201A]">{item.client?.full_name}</div>
          <div className="text-xs text-[rgb(90,102,96)]">{item.client?.email}</div>
        </div>
      ),
    },
    {
      key: 'gym',
      label: 'Gym',
      render: (item: TrainerAssignment) => item.gym?.name || 'N/A',
    },
    {
      key: 'assignment_type',
      label: 'Type',
      render: (item: TrainerAssignment) => (
        <span className="px-2 py-1 bg-[#F2F7D9] text-[#0B3D2E] rounded-full text-xs font-semibold uppercase">
          {item.assignment_type.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'sessions_per_week',
      label: 'Sessions/Week',
      render: (item: TrainerAssignment) => `${item.sessions_per_week}x ${item.session_duration_minutes}min`,
    },
    {
      key: 'start_date',
      label: 'Start Date',
      render: (item: TrainerAssignment) => new Date(item.start_date).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: TrainerAssignment) => (
        <button
          onClick={() => {
            setSelectedClient(item);
            setActiveTab('progress');
          }}
          className="rounded-lg bg-[#0B3D2E] px-3 py-1.5 text-xs font-semibold text-[#F2F7D9] transition-colors hover:bg-[#135440] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3D2E]"
        >
          View progress
        </button>
      ),
    },
  ];

  const noteColumns = [
    {
      key: 'note_date',
      label: 'Date',
      render: (item: ProgressNote) => new Date(item.note_date).toLocaleDateString(),
    },
    {
      key: 'note_type',
      label: 'Type',
      render: (item: ProgressNote) => (
        <span className="px-2 py-1 bg-[#0B3D2E] text-[#F2F7D9] rounded-full text-xs font-semibold uppercase">
          {item.note_type || 'general'}
        </span>
      ),
    },
    {
      key: 'content',
      label: 'Note',
      render: (item: ProgressNote) => (
        <div className="max-w-md truncate">{item.content}</div>
      ),
    },
    {
      key: 'measurements',
      label: 'Measurements',
      render: (item: ProgressNote) =>
        item.measurements ? (
          <div className="text-xs">
            {Object.entries(item.measurements)
              .slice(0, 2)
              .map(([key, value]) => (
                <div key={key}>
                  {key}: {value}
                </div>
              ))}
          </div>
        ) : (
          '-'
        ),
    },
  ];

  const activeClients = clients.filter((c) => c.status === 'active').length;
  const totalSessions = clients.reduce(
    (sum, client) =>
      sum + (client.status === 'active' ? client.sessions_per_week : 0),
    0
  );
  const totalSessionMinutes = clients.reduce(
    (sum, client) =>
      sum +
      (client.status === 'active'
        ? client.sessions_per_week * client.session_duration_minutes
        : 0),
    0
  );
  const weeklySessionTime = `${Math.floor(totalSessionMinutes / 60)}h${
    totalSessionMinutes % 60 ? ` ${totalSessionMinutes % 60}m` : ''
  }`;
  const activeCoachingPrograms = new Set(
    clients
      .filter((client) => client.status === 'active')
      .map((client) => client.assignment_type)
  ).size;
  const currentSection = TRAINER_SECTIONS.find((section) => section.id === activeTab);
  const sectionDescriptions: Record<string, string> = {
    overview: `Welcome back, ${user.full_name}. Here is your coaching overview.`,
    clients: 'Review client assignments, coaching focus, and weekly session commitments.',
    schedule: 'Review your coaching workload and weekly client commitments.',
    progress: 'Record assessments and keep each client’s progress in one place.',
  };
  const trainerStats: {
    title: string;
    value: string | number;
    detail: string;
    icon: LucideIcon;
    iconClass: string;
    target: string;
  }[] = [
    {
      title: 'Active clients',
      value: activeClients,
      detail: `${clients.length} total assigned`,
      icon: Users,
      iconClass: 'bg-[#F2F7D9] text-[#0B3D2E]',
      target: 'clients',
    },
    {
      title: 'Weekly sessions',
      value: totalSessions,
      detail: 'Across active assignments',
      icon: Dumbbell,
      iconClass: 'bg-[#FBE9E1] text-[#C1502E]',
      target: 'schedule',
    },
    {
      title: 'Client progress notes',
      value: progressNotes.length,
      detail: selectedClient?.client?.full_name
        ? `For ${selectedClient.client.full_name}`
        : 'For selected client',
      icon: ClipboardList,
      iconClass: 'bg-[#E8F0EB] text-[#0B3D2E]',
      target: 'progress',
    },
    {
      title: 'Coaching specialties',
      value: activeCoachingPrograms,
      detail: 'Across active programs',
      icon: Target,
      iconClass: 'bg-[#F2F7D9] text-[#0B3D2E]',
      target: 'clients',
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
                Coach workspace
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-[#14201A]/10 bg-[#F3EFE5]/70 p-3">
            <p className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6660]">
              Coaching team
            </p>
            <div className="mt-2 flex items-center gap-2.5">
              <Users className="h-4 w-4 shrink-0 text-[#0B3D2E]" />
              <span className="truncate text-sm font-semibold text-[#14201A]">
                {activeClients} active {activeClients === 1 ? 'client' : 'clients'}
              </span>
            </div>
          </div>

          <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6660]">
            Workspace
          </p>
          <nav aria-label="Trainer navigation" className="space-y-1">
            {TRAINER_SECTIONS.map((section) => {
              const Icon = section.icon;
              const selected = activeTab === section.id;
              const count = section.id === 'clients' ? clients.length : null;

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
              {user.full_name.trim().charAt(0).toUpperCase() || 'T'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user.full_name}</p>
              <p className="text-xs text-[#5A6660]">Trainer</p>
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
                Coach workspace
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
                Trainer workspace
              </p>
              <h1 className="mt-1 font-serif text-3xl text-[#0B3D2E] sm:text-4xl">
                {currentSection?.label || 'Overview'}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5A6660]">
                {sectionDescriptions[activeTab]}
              </p>
            </div>
            {activeTab === 'progress' && selectedClient && (
              <QuickActionButton
                label="Add progress note"
                icon={MessageSquare}
                onClick={() => setShowNoteModal(true)}
                variant="primary"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Link href="/trainer/programs" className="rounded-xl bg-[#0B3D2E] px-4 py-2.5 text-sm font-semibold text-[#F2F7D9]">Training programs</Link>
              <Link href="/trainer/messages" className="rounded-xl border border-[#14201A]/15 bg-[#FCFAF6] px-4 py-2.5 text-sm font-semibold text-[#0B3D2E]">Client messages</Link>
            </div>
          </div>

          {clientLoadError && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-2xl border border-[#C1502E]/20 bg-[#FBE9E1] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm font-medium text-[#8C321B]">{clientLoadError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setClientReload((current) => current + 1);
                }}
                className="shrink-0 rounded-lg bg-[#C1502E] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#A94124] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C1502E]"
              >
                Try again
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <>
              <section className="relative overflow-hidden rounded-[28px] bg-[#0B3D2E] p-6 text-[#F3EFE5] shadow-sm sm:p-8">
                <div className="absolute -right-8 -top-16 h-56 w-56 rounded-full border border-white/10" />
                <div className="absolute -right-2 -top-10 h-44 w-44 rounded-full border border-white/10" />
                <div className="relative flex items-center justify-between gap-5">
                  <div className="max-w-2xl">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#F2F7D9]">
                      <Activity className="h-3.5 w-3.5" />
                      Coaching overview
                    </div>
                    <h2 className="font-serif text-3xl sm:text-4xl">
                      Good to see you, {user.full_name.trim().split(/\s+/)[0] || 'there'}.
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
                      Your coaching workspace is ready. Check on your clients, keep progress notes up to date, and plan your weekly sessions.
                    </p>
                  </div>
                  <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-white/15 bg-white/10 sm:flex">
                    <Dumbbell className="h-9 w-9 text-[#F2F7D9]" />
                  </div>
                </div>
              </section>

              <section aria-label="Trainer statistics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {trainerStats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <button
                      key={stat.title}
                      type="button"
                      onClick={() => setActiveTab(stat.target)}
                      className="group rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#0B3D2E]/20 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3D2E]"
                    >
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.iconClass}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="mt-5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#5A6660]">
                        {stat.title}
                      </span>
                      <span className="mt-1 block truncate font-serif text-3xl text-[#14201A]">
                        {stat.value}
                      </span>
                      <span className="mt-1 block truncate text-xs text-[#5A6660]">{stat.detail}</span>
                    </button>
                  );
                })}
              </section>

              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-serif text-2xl text-[#14201A]">Your coaching focus</h2>
                      <p className="mt-1 text-sm text-[#5A6660]">
                        Pick up where your clients need you most.
                      </p>
                    </div>
                    <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-[#F2F7D9] text-[#0B3D2E] sm:flex">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <QuickActionButton
                      label="Review clients"
                      icon={Users}
                      onClick={() => setActiveTab('clients')}
                      variant="primary"
                    />
                    <QuickActionButton
                      label="Write progress note"
                      icon={NotebookPen}
                      onClick={() => setActiveTab('progress')}
                      variant="secondary"
                    />
                    <QuickActionButton
                      label="Weekly workload"
                      icon={Calendar}
                      onClick={() => setActiveTab('schedule')}
                      variant="secondary"
                    />
                  </div>
                </section>

                <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2F7D9] text-[#0B3D2E]">
                      <Target className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-serif text-2xl text-[#14201A]">Weekly workload</h2>
                      <p className="mt-0.5 text-xs text-[#5A6660]">From your active assignments</p>
                    </div>
                  </div>
                  <div className="divide-y divide-[#14201A]/10">
                    <div className="flex items-center justify-between py-3">
                      <span className="text-sm text-[#5A6660]">Active clients</span>
                      <span className="font-serif text-2xl text-[#0B3D2E]">{activeClients}</span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <span className="text-sm text-[#5A6660]">Sessions per week</span>
                      <span className="font-serif text-2xl text-[#0B3D2E]">{totalSessions}</span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <span className="text-sm text-[#5A6660]">Coaching programs</span>
                      <span className="font-serif text-2xl text-[#C1502E]">
                        {activeCoachingPrograms}
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}

          {activeTab === 'clients' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl text-[#14201A]">Assigned clients</h2>
                  <p className="mt-1 text-sm text-[#5A6660]">
                    Review each client’s training plan and open their progress notes.
                  </p>
                </div>
                <span className="rounded-full bg-[#F2F7D9] px-3 py-1.5 text-xs font-semibold text-[#0B3D2E]">
                  {clients.length} {clients.length === 1 ? 'client' : 'clients'}
                </span>
              </div>
              <DataTable
                columns={clientColumns}
                data={clients}
                keyExtractor={(item) => item.id}
                emptyMessage="No clients are assigned to your trainer account yet."
              />
            </section>
          )}

          {activeTab === 'schedule' && (
            <section className="space-y-5">
              <div>
                <h2 className="font-serif text-2xl text-[#14201A]">Weekly session commitments</h2>
                <p className="mt-1 text-sm text-[#5A6660]">
                  Session frequency from your active client assignments.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: 'Active clients', value: activeClients, icon: Users },
                  { label: 'Sessions per week', value: totalSessions, icon: Dumbbell },
                  {
                    label: 'Weekly session time',
                    value: weeklySessionTime,
                    icon: Calendar,
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
              <div className="flex flex-col items-start gap-3 rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-serif text-xl text-[#14201A]">Class calendar & rosters</h3>
                  <p className="mt-1 text-sm text-[#5A6660]">View your recurring classes, upcoming member lists, and record attendance.</p>
                </div>
                <Link href="/trainer/schedule" className="shrink-0 rounded-xl bg-[#0B3D2E] px-4 py-2.5 text-sm font-semibold text-[#F2F7D9]">Open schedule</Link>
              </div>
            </section>
          )}

          {activeTab === 'progress' && (
            <section className="space-y-4">
              {clients.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] px-6 py-12 text-center shadow-sm">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2F7D9] text-[#0B3D2E]">
                    <NotebookPen className="h-7 w-7" />
                  </div>
                  <h2 className="mt-4 font-serif text-2xl text-[#14201A]">No clients to track yet</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#5A6660]">
                    Once a client is assigned to you, you can record assessments and follow their progress here.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('clients')}
                    className="mt-5 rounded-xl bg-[#0B3D2E] px-4 py-2.5 text-sm font-semibold text-[#F2F7D9] transition-colors hover:bg-[#135440] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3D2E]"
                  >
                    View clients
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-serif text-xl text-[#14201A]">Client progress</h2>
                      <p className="mt-1 text-xs text-[#5A6660]">
                        Select a client to review or add coaching notes.
                      </p>
                    </div>
                    <label className="relative sm:min-w-64">
                      <span className="sr-only">Select client for progress notes</span>
                      <select
                        value={selectedClient?.id ?? ''}
                        onChange={(event) => {
                          const nextClient = clients.find((client) => client.id === event.target.value);
                          if (nextClient) setSelectedClient(nextClient);
                        }}
                        className="w-full appearance-none rounded-xl border border-[#14201A]/10 bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-[#14201A] outline-none transition focus:border-[#0B3D2E]/40 focus:ring-2 focus:ring-[#0B3D2E]/10"
                      >
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.client?.full_name || 'Client'}
                          </option>
                        ))}
                      </select>
                      <Users className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5A6660]" />
                    </label>
                  </div>

                  {selectedClient && (
                    <div className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm sm:p-6">
                      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F2F7D9] font-semibold text-[#0B3D2E]">
                            {selectedClient.client?.full_name?.trim().charAt(0).toUpperCase() || 'C'}
                          </div>
                          <div>
                            <h3 className="font-serif text-xl text-[#14201A]">
                              {selectedClient.client?.full_name || 'Client'}
                            </h3>
                            <p className="text-sm text-[#5A6660]">
                              {selectedClient.client?.email || selectedClient.gym?.name || 'Progress notes'}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-[#F2F7D9] px-3 py-1.5 text-xs font-semibold text-[#0B3D2E]">
                          {progressNotes.length} {progressNotes.length === 1 ? 'note' : 'notes'}
                        </span>
                      </div>
                      {progressNoteError ? (
                        <div className="rounded-xl border border-[#C1502E]/20 bg-[#FBE9E1] p-4">
                          <p role="alert" className="text-sm text-[#8C321B]">{progressNoteError}</p>
                          <button
                            type="button"
                            onClick={() => fetchProgressNotes(selectedClient.client_id)}
                            className="mt-2 text-xs font-semibold text-[#8C321B] underline underline-offset-2"
                          >
                            Try loading notes again
                          </button>
                        </div>
                      ) : (
                        <DataTable
                          columns={noteColumns}
                          data={progressNotes}
                          keyExtractor={(item) => item.id}
                          emptyMessage="No progress notes for this client yet."
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </main>

      <nav
        aria-label="Trainer navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[#14201A]/10 bg-[#FCFAF6]/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-md lg:hidden"
      >
        {TRAINER_SECTIONS.map((section) => {
          const Icon = section.icon;
          const selected = activeTab === section.id;
          return (
            <button
              key={section.id}
              type="button"
              aria-current={selected ? 'page' : undefined}
              onClick={() => setActiveTab(section.id)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1.5 text-[9px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0B3D2E] ${
                selected ? 'text-[#0B3D2E]' : 'text-[#5A6660]'
              }`}
            >
              <span className={`rounded-full p-1 ${selected ? 'bg-[#F2F7D9]' : ''}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate">
                {section.id === 'progress' ? 'Progress' : section.label}
              </span>
            </button>
          );
        })}
      </nav>

      <Modal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        title="Add progress note"
        size="md"
      >
        <div className="space-y-4">
          {selectedClient && (
            <p className="text-sm text-[#5A6660]">
              For <span className="font-semibold text-[#14201A]">{selectedClient.client?.full_name}</span>
            </p>
          )}
          <div>
            <label
              htmlFor="progress-note-type"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#5A6660]"
            >
              Note type
            </label>
            <select
              id="progress-note-type"
              value={noteType}
              onChange={(event) => {
                const nextType = PROGRESS_NOTE_TYPES.find(
                  (type) => type === event.target.value
                );
                if (nextType) setNoteType(nextType);
              }}
              className="w-full rounded-xl border border-[#14201A]/15 bg-white px-4 py-3 text-sm"
            >
              <option value="general">General</option>
              <option value="assessment">Assessment</option>
              <option value="progress">Progress update</option>
              <option value="injury">Injury note</option>
              <option value="goal_update">Goal update</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="progress-note-content"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#5A6660]"
            >
              Note content
            </label>
            <textarea
              id="progress-note-content"
              value={noteContent}
              onChange={(event) => setNoteContent(event.target.value)}
              placeholder="Enter progress note details..."
              rows={6}
              className="w-full resize-none rounded-xl border border-[#14201A]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#0B3D2E]/40 focus:ring-2 focus:ring-[#0B3D2E]/10"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowNoteModal(false)}
              className="flex-1 rounded-xl bg-black/5 px-4 py-3 text-sm font-semibold text-[#5A6660] transition-colors hover:bg-black/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddNote}
              disabled={!noteContent.trim() || saveNoteLoading}
              className="flex-1 rounded-xl bg-[#0B3D2E] px-4 py-3 text-sm font-semibold text-[#F2F7D9] transition-colors hover:bg-[#135440] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveNoteLoading ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
