'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  ClipboardList,
  TrendingUp,
  Calendar,
  MessageSquare,
  Dumbbell,
  Target,
} from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import DataTable from '@/components/dashboard/DataTable';
import PageHeader from '@/components/dashboard/PageHeader';
import TabNavigation from '@/components/dashboard/TabNavigation';
import QuickActionButton from '@/components/dashboard/QuickActionButton';
import Modal from '@/components/dashboard/Modal';
import ThemeToggle from '@/components/ThemeToggle';
import { TrainerAssignment, ProgressNote } from '@/types';

export default function TrainerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [clients, setClients] = useState<TrainerAssignment[]>([]);
  const [selectedClient, setSelectedClient] = useState<TrainerAssignment | null>(null);
  const [progressNotes, setProgressNotes] = useState<ProgressNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('clients');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<'assessment' | 'progress' | 'general'>('general');

  // Check authentication and role
  useEffect(() => {
    const storedUser = localStorage.getItem('urji_user');
    if (!storedUser) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser.role !== 'trainer') {
        alert('Access denied. Trainer role required.');
        router.push('/dashboard');
        return;
      }
      setUser(parsedUser);
    } catch {
      router.push('/login');
    }
  }, [router]);

  // Fetch assigned clients
  const fetchClients = useCallback(async () => {
    if (!user) return;

    try {
      const res = await fetch(`/api/trainer/clients?trainerId=${user.id}`);
      const data = await res.json();
      if (res.ok && data.assignments) {
        setClients(data.assignments);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch progress notes for a client
  const fetchProgressNotes = useCallback(async (clientId: string) => {
    if (!user) return;

    try {
      const res = await fetch(`/api/trainer/progress-notes?clientId=${clientId}&trainerId=${user.id}`);
      const data = await res.json();
      if (res.ok && data.notes) {
        setProgressNotes(data.notes);
      }
    } catch (error) {
      console.error('Failed to fetch progress notes:', error);
    }
  }, [user]);

  // Add progress note
  const handleAddNote = async () => {
    if (!selectedClient || !noteContent.trim()) return;

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

      if (res.ok) {
        setShowNoteModal(false);
        setNoteContent('');
        fetchProgressNotes(selectedClient.client_id);
        alert('Progress note added successfully!');
      }
    } catch (error) {
      console.error('Failed to add note:', error);
      alert('Failed to add note');
    }
  };

  useEffect(() => {
    if (user) {
      fetchClients();
    }
  }, [user, fetchClients]);

  useEffect(() => {
    if (selectedClient) {
      fetchProgressNotes(selectedClient.client_id);
    }
  }, [selectedClient, fetchProgressNotes]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F3EFE5]">
        <p className="font-serif text-2xl text-[#0B3D2E]">Loading Trainer Dashboard...</p>
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
          onClick={() => setSelectedClient(item)}
          className="px-3 py-1.5 bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9] rounded-lg text-xs font-semibold"
        >
          View Details
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
  const totalSessions = clients.reduce((sum, c) => sum + c.sessions_per_week, 0);

  return (
    <div className="min-h-screen bg-[#F3EFE5] p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <PageHeader
          badge="Trainer Dashboard"
          title={`Welcome, ${user.full_name}`}
          subtitle="Manage your clients, track progress, and schedule sessions"
          actions={
            <>
              <ThemeToggle variant="pill" />
              <QuickActionButton
                label="My Schedule"
                icon={Calendar}
                onClick={() => alert('Schedule view coming soon')}
                variant="secondary"
              />
            </>
          }
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatsCard
            title="Active Clients"
            value={activeClients}
            subtitle={`${clients.length} total assigned`}
            icon={Users}
            iconColor="text-[#0B3D2E]"
          />
          <StatsCard
            title="Weekly Sessions"
            value={totalSessions}
            subtitle="Scheduled sessions"
            icon={Dumbbell}
            iconColor="text-[#C1502E]"
          />
          <StatsCard
            title="Progress Notes"
            value={progressNotes.length}
            subtitle="Total recorded"
            icon={ClipboardList}
            iconColor="text-sky-600"
          />
          <StatsCard
            title="Client Goals"
            value={activeClients}
            subtitle="In progress"
            icon={Target}
            iconColor="text-emerald-600"
          />
        </div>

        {/* Tab Navigation */}
        <TabNavigation
          tabs={[
            { id: 'clients', label: 'My Clients', count: clients.length },
            { id: 'schedule', label: 'Schedule' },
            { id: 'progress', label: 'Progress Tracking' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {/* Tab Content */}
        {activeTab === 'clients' && (
          <div className="space-y-4">
            <DataTable
              columns={clientColumns}
              data={clients}
              keyExtractor={(item) => item.id}
              emptyMessage="No clients assigned yet"
            />
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-12 text-center">
            <Calendar className="w-16 h-16 text-[rgb(90,102,96)] mx-auto mb-4" />
            <h3 className="font-serif text-2xl text-[#14201A] mb-2">Session Calendar</h3>
            <p className="text-[rgb(90,102,96)]">Weekly schedule view coming soon</p>
          </div>
        )}

        {activeTab === 'progress' && selectedClient && (
          <div className="space-y-4">
            <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-serif text-xl text-[#14201A]">
                    {selectedClient.client?.full_name}
                  </h3>
                  <p className="text-sm text-[rgb(90,102,96)]">Progress Notes & Assessments</p>
                </div>
                <QuickActionButton
                  label="Add Note"
                  icon={MessageSquare}
                  onClick={() => setShowNoteModal(true)}
                  variant="primary"
                />
              </div>
              <DataTable
                columns={noteColumns}
                data={progressNotes}
                keyExtractor={(item) => item.id}
                emptyMessage="No progress notes yet"
              />
            </div>
          </div>
        )}

        {activeTab === 'progress' && !selectedClient && (
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-12 text-center">
            <TrendingUp className="w-16 h-16 text-[rgb(90,102,96)] mx-auto mb-4" />
            <h3 className="font-serif text-2xl text-[#14201A] mb-2">Select a Client</h3>
            <p className="text-[rgb(90,102,96)]">Choose a client from the Clients tab to view and add progress notes</p>
          </div>
        )}

        {/* Add Note Modal */}
        <Modal
          isOpen={showNoteModal}
          onClose={() => setShowNoteModal(false)}
          title="Add Progress Note"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1.5">
                Note Type
              </label>
              <select
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as any)}
                className="w-full px-4 py-3 bg-white border border-[#14201A]/15 rounded-xl text-sm"
              >
                <option value="general">General</option>
                <option value="assessment">Assessment</option>
                <option value="progress">Progress Update</option>
                <option value="injury">Injury Note</option>
                <option value="goal_update">Goal Update</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1.5">
                Note Content
              </label>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Enter progress note details..."
                rows={6}
                className="w-full px-4 py-3 bg-white border border-[#14201A]/15 rounded-xl text-sm resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowNoteModal(false)}
                className="flex-1 px-4 py-3 bg-black/5 hover:bg-black/10 text-[rgb(90,102,96)] rounded-xl text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                disabled={!noteContent.trim()}
                className="flex-1 px-4 py-3 bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9] rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                Save Note
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
