'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Dumbbell,
  CalendarDays,
  TrendingUp,
  DollarSign,
  UserPlus,
  Building2,
  Settings,
  BarChart3,
  ClipboardList,
} from 'lucide-react';
import StatsCard from '@/components/dashboard/StatsCard';
import DataTable from '@/components/dashboard/DataTable';
import PageHeader from '@/components/dashboard/PageHeader';
import TabNavigation from '@/components/dashboard/TabNavigation';
import QuickActionButton from '@/components/dashboard/QuickActionButton';
import ThemeToggle from '@/components/ThemeToggle';
import { Gym, GymMembership, GymStaff, Class } from '@/types';

interface DashboardStats {
  totalMembers: number;
  totalStaff: number;
  totalClasses: number;
  todayAttendance: number;
  monthlyRevenue: number;
  expiringMemberships: number;
}

export default function GymOwnerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [members, setMembers] = useState<GymMembership[]>([]);
  const [staff, setStaff] = useState<GymStaff[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Check authentication and role
  useEffect(() => {
    const storedUser = localStorage.getItem('urji_user');
    if (!storedUser) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser.role !== 'gym_owner') {
        alert('Access denied. Gym owner role required.');
        router.push('/dashboard');
        return;
      }
      setUser(parsedUser);
    } catch {
      router.push('/login');
    }
  }, [router]);

  // Fetch user's gyms
  const fetchGyms = useCallback(async () => {
    if (!user) return;

    try {
      const res = await fetch(`/api/gyms?userId=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (res.ok && data.gyms) {
        setGyms(data.gyms);
        if (data.gyms.length > 0 && !selectedGym) {
          setSelectedGym(data.gyms[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch gyms:', error);
    }
  }, [user, selectedGym]);

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
      Promise.all([
        fetchStats(selectedGym.id),
        fetchMembers(selectedGym.id),
        fetchStaff(selectedGym.id),
        fetchClasses(selectedGym.id),
      ]).finally(() => setLoading(false));
    }
  }, [selectedGym, fetchStats, fetchMembers, fetchStaff, fetchClasses]);

  useEffect(() => {
    if (user) {
      fetchGyms();
    }
  }, [user, fetchGyms]);

  if (loading || !user || !selectedGym) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F3EFE5]">
        <p className="font-serif text-2xl text-[#0B3D2E]">Loading Gym Dashboard...</p>
      </div>
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

  return (
    <div className="min-h-screen bg-[#F3EFE5] p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <PageHeader
          badge="Gym Owner Dashboard"
          title={selectedGym.name}
          subtitle="Manage your gym operations, staff, members, and classes"
          actions={
            <>
              <ThemeToggle variant="pill" />
              <QuickActionButton
                label="Gym Settings"
                icon={Settings}
                onClick={() => alert('Settings coming soon')}
                variant="secondary"
              />
            </>
          }
        />

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatsCard
              title="Total Members"
              value={stats.totalMembers}
              subtitle={`${stats.expiringMemberships} expiring soon`}
              icon={Users}
              iconColor="text-[#0B3D2E]"
              onClick={() => setActiveTab('members')}
            />
            <StatsCard
              title="Staff Members"
              value={stats.totalStaff}
              subtitle="Active trainers & staff"
              icon={Dumbbell}
              iconColor="text-[#C1502E]"
              onClick={() => setActiveTab('staff')}
            />
            <StatsCard
              title="Active Classes"
              value={stats.totalClasses}
              subtitle="Weekly schedule"
              icon={CalendarDays}
              iconColor="text-sky-600"
              onClick={() => setActiveTab('classes')}
            />
            <StatsCard
              title="Monthly Revenue"
              value={`ETB ${stats.monthlyRevenue.toLocaleString()}`}
              subtitle="This month"
              icon={DollarSign}
              iconColor="text-emerald-600"
            />
          </div>
        )}

        {/* Tab Navigation */}
        <TabNavigation
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'members', label: 'Members', count: members.length },
            { id: 'staff', label: 'Staff', count: staff.length },
            { id: 'classes', label: 'Classes', count: classes.length },
            { id: 'analytics', label: 'Analytics' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-6">
                <h3 className="font-serif text-xl text-[#14201A] mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <QuickActionButton
                    label="Add New Member"
                    icon={UserPlus}
                    onClick={() => alert('Add member modal')}
                    variant="primary"
                  />
                  <QuickActionButton
                    label="Check In Member"
                    icon={ClipboardList}
                    onClick={() => alert('Check-in modal')}
                    variant="secondary"
                  />
                  <QuickActionButton
                    label="View Reports"
                    icon={BarChart3}
                    onClick={() => setActiveTab('analytics')}
                    variant="secondary"
                  />
                </div>
              </div>

              <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-6">
                <h3 className="font-serif text-xl text-[#14201A] mb-4">Today's Activity</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[rgb(90,102,96)]">Check-ins Today</span>
                    <span className="text-2xl font-serif text-[#0B3D2E]">{stats?.todayAttendance}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[rgb(90,102,96)]">Active Members</span>
                    <span className="text-2xl font-serif text-[#0B3D2E]">{stats?.totalMembers}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-2xl text-[#14201A]">Members</h3>
              <QuickActionButton
                label="Add Member"
                icon={UserPlus}
                onClick={() => alert('Add member')}
                variant="primary"
              />
            </div>
            <DataTable
              columns={memberColumns}
              data={members}
              keyExtractor={(item) => item.id}
              emptyMessage="No members yet"
            />
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-2xl text-[#14201A]">Staff & Trainers</h3>
              <QuickActionButton
                label="Add Staff"
                icon={UserPlus}
                onClick={() => alert('Add staff')}
                variant="primary"
              />
            </div>
            <DataTable
              columns={staffColumns}
              data={staff}
              keyExtractor={(item) => item.id}
              emptyMessage="No staff members yet"
            />
          </div>
        )}

        {activeTab === 'classes' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-serif text-2xl text-[#14201A]">Classes</h3>
              <QuickActionButton
                label="Create Class"
                icon={CalendarDays}
                onClick={() => alert('Create class')}
                variant="primary"
              />
            </div>
            <DataTable
              columns={classColumns}
              data={classes}
              keyExtractor={(item) => item.id}
              emptyMessage="No classes scheduled yet"
            />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-12 text-center">
            <TrendingUp className="w-16 h-16 text-[rgb(90,102,96)] mx-auto mb-4" />
            <h3 className="font-serif text-2xl text-[#14201A] mb-2">Analytics Dashboard</h3>
            <p className="text-[rgb(90,102,96)]">Detailed analytics and reports coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
