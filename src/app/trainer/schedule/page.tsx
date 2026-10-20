'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';

interface TrainerClass {
  id: string;
  gym_id: string;
  name: string;
  description: string | null;
  class_type: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  capacity: number | null;
  gym: { id: string; name: string } | null;
}
interface ClassRosterBooking {
  id: string;
  class_id: string;
  member_id: string;
  booking_date: string;
  status: string;
  checked_in_at: string | null;
  member: { id: string; full_name: string; phone: string | null } | Array<{ id: string; full_name: string; phone: string | null }> | null;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function memberOf(booking: ClassRosterBooking) {
  return Array.isArray(booking.member) ? booking.member[0] ?? null : booking.member;
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export default function TrainerSchedulePage() {
  const { user, loading: sessionLoading } = useUserSession();
  const [classes, setClasses] = useState<TrainerClass[]>([]);
  const [bookings, setBookings] = useState<ClassRosterBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyBooking, setBusyBooking] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/trainer/schedule');
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.classes) || !Array.isArray(result.bookings)) {
        throw new Error(result.error || 'Could not load your class schedule.');
      }
      setClasses(result.classes as TrainerClass[]);
      setBookings(result.bookings as ClassRosterBooking[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your class schedule.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch the schedule after confirming the signed trainer session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!sessionLoading && user?.role === 'trainer') void loadSchedule();
  }, [sessionLoading, user, loadSchedule]);

  const classById = useMemo(() => new Map(classes.map((gymClass) => [gymClass.id, gymClass])), [classes]);
  const rosterByDate = useMemo(() => {
    const grouped = new Map<string, ClassRosterBooking[]>();
    for (const booking of bookings) {
      const key = `${booking.booking_date}:${booking.class_id}`;
      grouped.set(key, [...(grouped.get(key) ?? []), booking]);
    }
    return grouped;
  }, [bookings]);

  async function markAttendance(booking: ClassRosterBooking, status: 'attended' | 'no_show') {
    setBusyBooking(booking.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/trainer/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: booking.id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update class attendance.');
      setNotice(`${memberOf(booking)?.full_name ?? 'Member'} marked ${status === 'attended' ? 'attended' : 'no-show'}.`);
      await loadSchedule();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update class attendance.');
    } finally {
      setBusyBooking('');
    }
  }

  if (sessionLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F3EFE5] text-[#0B3D2E]">Loading trainer schedule…</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#F3EFE5]">
      <Navigation userFullName={user?.full_name} userRole={user?.role} />
      <main className="mx-auto min-w-0 max-w-6xl flex-1 space-y-7 p-5 pb-24 md:p-10 md:pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0B3D2E]">Coach workspace</p>
            <h1 className="mt-1 font-serif text-4xl text-[#14201A]">Class schedule</h1>
            <p className="mt-2 text-sm text-[#5A6660]">Your recurring classes and member rosters for the coming four weeks.</p>
          </div>
          <Link href="/trainer" className="rounded-xl border border-[#14201A]/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#0B3D2E]">Coach dashboard</Link>
        </header>
        {error && <p role="alert" className="rounded-xl bg-[#FBE9E1] px-4 py-3 text-sm text-[#8E341E]">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-[#F2F7D9] px-4 py-3 text-sm text-[#0B3D2E]">{notice}</p>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {!classes.length && <p className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 text-sm text-[#5A6660]">No recurring classes are assigned to your trainer account yet. Your weekly client commitments are still visible on the coach dashboard.</p>}
          {classes.map((gymClass) => <article key={gymClass.id} className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-[#F2F7D9] p-2 text-[#0B3D2E]"><CalendarDays className="h-5 w-5" /></span>
              <div><h2 className="font-semibold text-[#14201A]">{gymClass.name}</h2><p className="text-xs text-[#5A6660]">{gymClass.gym?.name}</p></div>
            </div>
            <p className="mt-4 text-sm font-semibold text-[#0B3D2E]">{WEEKDAYS[gymClass.day_of_week]} · {gymClass.start_time.slice(0, 5)}</p>
            <p className="mt-1 text-xs capitalize text-[#5A6660]">{gymClass.class_type.replaceAll('_', ' ')} · {gymClass.duration_minutes} minutes{gymClass.capacity ? ` · capacity ${gymClass.capacity}` : ''}</p>
          </article>)}
        </section>

        <section className="rounded-3xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm md:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0B3D2E]">Next four weeks</p>
            <h2 className="mt-1 font-serif text-2xl text-[#14201A]">Class rosters & attendance</h2>
          </div>
          {!rosterByDate.size ? <p className="mt-4 text-sm text-[#5A6660]">No member reservations are currently on your class rosters.</p> :
            <div className="mt-5 space-y-5">
              {[...rosterByDate.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([key, roster]) => {
                const first = roster[0];
                const gymClass = classById.get(first.class_id);
                if (!gymClass) return null;
                return <section key={key} className="overflow-hidden rounded-2xl border border-[#14201A]/10">
                  <div className="flex flex-wrap justify-between gap-2 bg-[#F3EFE5]/80 px-4 py-3">
                    <h3 className="font-semibold text-[#14201A]">{gymClass.name} · {formatDate(first.booking_date)}</h3>
                    <span className="text-xs text-[#5A6660]">{roster.filter((booking) => booking.status === 'booked').length} booked · {roster.filter((booking) => booking.status === 'waitlisted').length} waitlisted</span>
                  </div>
                  <div className="divide-y divide-[#14201A]/10">
                    {roster.map((booking) => {
                      const member = memberOf(booking);
                      return <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div><p className="text-sm font-semibold text-[#14201A]">{member?.full_name ?? 'Member'}</p><p className="text-xs text-[#5A6660]">{booking.status}{member?.phone ? ` · ${member.phone}` : ''}</p></div>
                        {booking.status === 'booked' && <div className="flex gap-2">
                          <button disabled={busyBooking === booking.id} onClick={() => void markAttendance(booking, 'attended')} className="rounded-lg bg-[#0B3D2E] px-3 py-2 text-xs font-semibold text-[#F2F7D9] disabled:opacity-60">Attended</button>
                          <button disabled={busyBooking === booking.id} onClick={() => void markAttendance(booking, 'no_show')} className="rounded-lg border border-[#C1502E]/25 px-3 py-2 text-xs font-semibold text-[#C1502E] disabled:opacity-60">No-show</button>
                        </div>}
                      </div>;
                    })}
                  </div>
                </section>;
              })}
            </div>}
        </section>
      </main>
    </div>
  );
}
