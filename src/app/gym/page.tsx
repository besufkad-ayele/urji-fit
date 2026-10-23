'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, CheckCircle2, Clock3, MapPin, QrCode, ShieldCheck } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';

interface Gym {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
}
interface Membership {
  id: string;
  gym_id: string;
  membership_type: string;
  price: number;
  status: string;
  start_date: string;
  end_date: string | null;
  sessions_remaining: number | null;
  is_active_today: boolean;
  remaining_days: number | null;
}
interface GymClass {
  id: string;
  gym_id: string;
  name: string;
  class_type: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
}
interface ClassBooking {
  id: string;
  booking_date: string;
  status: string;
  class: GymClass | GymClass[] | null;
  gym: Gym | null;
}
interface Visit {
  id: string;
  gym_id: string;
  check_in_at: string;
  check_out_at: string | null;
  attendance_type: string;
  gym: Gym | null;
}

function classOf(booking: ClassBooking): GymClass | null {
  return Array.isArray(booking.class) ? booking.class[0] ?? null : booking.class;
}

function formatDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function MemberGymPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useUserSession();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [bookings, setBookings] = useState<ClassBooking[]>([]);
  const [attendance, setAttendance] = useState<Visit[]>([]);
  const [selectedGymId, setSelectedGymId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/member/gym');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load your gym overview.');
      setMemberships(result.memberships);
      setGyms(result.gyms);
      setBookings(result.bookings);
      setAttendance(result.attendance);
      const defaultGymId = result.memberships.find((membership: Membership) => membership.is_active_today)?.gym_id ??
        result.home_gym_id ??
        result.gyms[0]?.id ??
        '';
      setSelectedGymId((current) => current || defaultGymId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your gym overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !user) router.replace('/login');
    if (!sessionLoading && user && user.role !== 'member') {
      router.replace(user.role === 'trainer' ? '/trainer' : '/gym-owner');
    }
    // Load the authenticated member's memberships, bookings, and attendance.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!sessionLoading && user?.role === 'member') void loadOverview();
  }, [loadOverview, router, sessionLoading, user]);

  const activeMemberships = memberships.filter((membership) => membership.is_active_today);
  const selectedGym = gyms.find((gym) => gym.id === selectedGymId) ?? null;
  const selectedMemberships = activeMemberships.filter((membership) => membership.gym_id === selectedGymId);
  const openVisit = attendance.find((visit) => visit.gym_id === selectedGymId && !visit.check_out_at);
  const upcomingBookings = bookings.filter((booking) => {
    const gymClass = classOf(booking);
    return gymClass?.gym_id === selectedGymId;
  });
  const selectedVisits = attendance.filter((visit) => visit.gym_id === selectedGymId);
  const membershipByGym = useMemo(() => new Map(gyms.map((gym) => [
    gym.id,
    memberships.filter((membership) => membership.gym_id === gym.id && membership.is_active_today).length > 0,
  ])), [gyms, memberships]);

  async function changeCheckIn(action: 'check_in' | 'check_out') {
    if (!user || !selectedGymId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gym_id: selectedGymId,
          member_id: user.id,
          attendance_type: 'open_gym',
          action,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update your attendance.');
      setNotice(action === 'check_in' ? 'You are checked in. Have a great workout!' : 'You are checked out. Nice work today!');
      await loadOverview();
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : 'Could not update your attendance.');
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || loading || !user || user.role !== 'member') {
    return <main className="flex min-h-screen items-center justify-center bg-[#F3EFE5] text-[#0B3D2E]">Loading your gym…</main>;
  }

  return (
    <div className="min-h-screen bg-[#F3EFE5] md:flex">
      <Navigation userFullName={user.full_name} userRole={user.role} />
      <main className="mx-auto min-w-0 max-w-6xl flex-1 space-y-6 px-4 py-8 pb-24 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5A6660]">Member experience</p>
            <h1 className="mt-2 font-serif text-4xl text-[#0B3D2E]">My gym</h1>
            <p className="mt-2 text-sm text-[#5A6660]">Membership access, class calendar, and recent visits in one place.</p>
          </div>
          {gyms.length > 1 && <label className="text-xs font-semibold text-[#5A6660]">Gym
            <select value={selectedGymId} onChange={(event) => setSelectedGymId(event.target.value)} className="mt-1 block min-w-48 rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm text-[#14201A]">
              {gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
            </select>
          </label>}
        </header>

        {error && <p role="alert" className="rounded-xl border border-[#C1502E]/20 bg-[#FBE9E1] px-4 py-3 text-sm text-[#8E341E]">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-[#0B3D2E]/15 bg-[#F2F7D9] px-4 py-3 text-sm text-[#0B3D2E]">{notice}</p>}

        {!gyms.length ? (
          <section className="rounded-3xl border border-[#14201A]/10 bg-[#FCFAF6] p-6 text-sm text-[#5A6660]">No gym is connected to this account yet. Contact your administrator to update your account.</section>
        ) : (
          <>
            {selectedGym && <section className="rounded-3xl bg-[#0B3D2E] p-6 text-[#F2F7D9] shadow-sm md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F2F7D9]/75">Your gym</p>
                  <h2 className="mt-1 font-serif text-3xl">{selectedGym.name}</h2>
                  {(selectedGym.address || selectedGym.city) && <p className="mt-2 flex items-center gap-2 text-sm text-[#F2F7D9]/80"><MapPin className="h-4 w-4" /> {[selectedGym.address, selectedGym.city].filter(Boolean).join(', ')}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href="/classes" className="rounded-xl bg-[#F2F7D9] px-4 py-2.5 text-sm font-semibold text-[#0B3D2E]">Browse classes</Link>
                  <Link href="/payments" className="rounded-xl border border-[#F2F7D9]/30 px-4 py-2.5 text-sm font-semibold text-[#F2F7D9]">Billing</Link>
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {selectedMemberships.map((membership) => (
                  <div key={membership.id} className="rounded-2xl bg-white/10 p-4">
                    <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /><p className="font-semibold capitalize">{membership.membership_type.replaceAll('_', ' ')}</p></div>
                    <p className="mt-2 text-sm text-[#F2F7D9]/80">Active · {membership.end_date ? `${membership.remaining_days} days remaining` : 'No expiry date'}</p>
                    {membership.sessions_remaining !== null && <p className="mt-1 text-sm text-[#F2F7D9]/80">{membership.sessions_remaining} sessions remaining</p>}
                    <p className="mt-1 text-xs text-[#F2F7D9]/65">Valid {formatDate(membership.start_date)}{membership.end_date ? ` – ${formatDate(membership.end_date)}` : ' onward'}</p>
                  </div>
                ))}
                {!selectedMemberships.length && <p className="rounded-2xl bg-white/10 p-4 text-sm">You are connected to this gym, but do not have an active membership yet. Contact the gym to enroll or restore access.</p>}
              </div>
            </section>}

            <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              <article className="rounded-3xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0B3D2E]">Open gym</p>
                    <h2 className="mt-1 font-serif text-2xl text-[#14201A]">Check in</h2>
                  </div>
                  <QrCode className="h-6 w-6 text-[#0B3D2E]" />
                </div>
                <p className="mt-2 text-sm text-[#5A6660]">Record your visit in the app. This does not unlock a door or generate a QR/PIN access credential.</p>
                {openVisit ? (
                  <div className="mt-5 rounded-2xl bg-[#F2F7D9] p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#0B3D2E]"><CheckCircle2 className="h-4 w-4" /> Checked in at {new Date(openVisit.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <button disabled={busy} onClick={() => void changeCheckIn('check_out')} className="mt-3 rounded-xl bg-[#0B3D2E] px-4 py-2.5 text-sm font-semibold text-[#F2F7D9] disabled:opacity-60">{busy ? 'Updating…' : 'Check out'}</button>
                  </div>
                ) : (
                  <button disabled={busy || !membershipByGym.get(selectedGymId)} onClick={() => void changeCheckIn('check_in')} className="mt-5 rounded-xl bg-[#0B3D2E] px-4 py-3 text-sm font-semibold text-[#F2F7D9] disabled:opacity-50">{busy ? 'Checking in…' : 'Check in to open gym'}</button>
                )}
                {!membershipByGym.get(selectedGymId) && <p className="mt-2 text-xs text-[#C1502E]">An active membership is required for app check-in.</p>}
              </article>
              <article className="rounded-3xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0B3D2E]">Your calendar</p>
                    <h2 className="mt-1 font-serif text-2xl text-[#14201A]">Upcoming classes</h2>
                  </div>
                  <CalendarDays className="h-6 w-6 text-[#0B3D2E]" />
                </div>
                {!upcomingBookings.length ? <p className="mt-4 text-sm text-[#5A6660]">No upcoming class bookings for this gym.</p> :
                  <div className="mt-4 space-y-2">
                    {upcomingBookings.map((booking) => {
                      const gymClass = classOf(booking);
                      if (!gymClass) return null;
                      return <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F3EFE5]/70 p-3">
                        <div><p className="font-semibold text-[#14201A]">{gymClass.name}</p><p className="mt-1 text-xs text-[#5A6660]">{formatDate(booking.booking_date)} · {gymClass.start_time.slice(0, 5)} · {gymClass.duration_minutes} min</p></div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${booking.status === 'waitlisted' ? 'bg-[#FBE9E1] text-[#8E341E]' : 'bg-[#F2F7D9] text-[#0B3D2E]'}`}>{booking.status}</span>
                      </div>;
                    })}
                  </div>}
                <Link href="/classes" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#0B3D2E]">Manage bookings <Clock3 className="h-4 w-4" /></Link>
              </article>
            </section>
          </>
        )}

        <section className="rounded-3xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0B3D2E]">Attendance</p><h2 className="mt-1 font-serif text-2xl text-[#14201A]">Visit history</h2></div>
            <span className="rounded-full bg-[#F2F7D9] px-3 py-1 text-xs font-semibold text-[#0B3D2E]">{selectedVisits.length} recent visits</span>
          </div>
          {!selectedVisits.length ? <p className="mt-4 text-sm text-[#5A6660]">Your visits will be listed here after your first check-in.</p> :
            <div className="mt-4 divide-y divide-[#14201A]/10">
              {selectedVisits.slice(0, 20).map((visit) => <div key={visit.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <div><p className="font-semibold text-[#14201A]">{visit.attendance_type.replaceAll('_', ' ')}</p><p className="text-xs text-[#5A6660]">{visit.gym?.name ?? selectedGym?.name}</p></div>
                <p className="text-right text-xs text-[#5A6660]">{new Date(visit.check_in_at).toLocaleString()}{visit.check_out_at ? ` · out ${new Date(visit.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' · in progress'}</p>
              </div>)}
            </div>}
        </section>
      </main>
    </div>
  );
}
