'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Clock3, MapPin, UserRound } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';

type ClassItem = {
  id: string;
  name: string;
  description: string | null;
  class_type: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  capacity: number | null;
  price: number | null;
  gym_name: string;
  trainer: { id: string; full_name: string; avatar_url: string | null } | null;
};
type Booking = {
  id: string;
  class_id: string;
  booking_date: string;
  status: 'booked' | 'waitlisted' | 'attended' | 'no_show' | 'canceled';
  class: { name: string };
};

function nextClassDates(dayOfWeek: number, count: number): string[] {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const difference = ((dayOfWeek - date.getDay() + 7) % 7) || 7;
  date.setDate(date.getDate() + difference);
  return Array.from({ length: count }, (_, index) => {
    const occurrence = new Date(date);
    occurrence.setDate(date.getDate() + index * 7);
    return `${occurrence.getFullYear()}-${String(occurrence.getMonth() + 1).padStart(2, '0')}-${String(occurrence.getDate()).padStart(2, '0')}`;
  });
}

function formatClassDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export default function MemberClassesPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useUserSession();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadClasses = useCallback(async () => {
    setError('');
    try {
      const [classResponse, bookingResponse] = await Promise.all([
        fetch('/api/member/classes'),
        fetch('/api/member/bookings'),
      ]);
      const classData = await classResponse.json();
      const bookingData = await bookingResponse.json();
      if (!classResponse.ok) throw new Error(classData.error || 'Could not load classes.');
      if (!bookingResponse.ok) throw new Error(bookingData.error || 'Could not load bookings.');
      setClasses(classData.classes);
      setBookings(bookingData.bookings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the class schedule.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && !user) router.replace('/login');
    if (!sessionLoading && user && user.role !== 'member') {
      router.replace(user.role === 'trainer' ? '/trainer' : '/gym-owner');
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!sessionLoading && user?.role === 'member') void loadClasses();
  }, [loadClasses, router, sessionLoading, user]);

  async function changeBooking(classItem: ClassItem, bookingDate: string, action: 'book' | 'cancel' | 'reschedule', newBookingDate?: string) {
    setBusy(`${classItem.id}:${bookingDate}`);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/classes/${classItem.id}/bookings${action === 'cancel' ? `?booking_date=${bookingDate}` : ''}`, {
        method: action === 'book' ? 'POST' : action === 'cancel' ? 'DELETE' : 'PATCH',
        ...(action !== 'cancel'
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(action === 'book'
                ? { booking_date: bookingDate }
                : { old_booking_date: bookingDate, new_booking_date: newBookingDate }),
            }
          : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update this booking.');
      if (action === 'book') {
        const waitlisted = data.booking?.booking_status === 'waitlisted';
        setNotice(waitlisted ? 'You are on the waitlist. Your place will be confirmed if a spot opens.' : 'Your class spot is booked.');
      } else if (action === 'reschedule') {
        setNotice(data.booking?.booking_status === 'waitlisted'
          ? 'Booking moved to the waitlist for the new date.'
          : 'Your class booking was rescheduled.');
      } else {
        setNotice(data.promoted_booking_id ? 'Booking canceled. The next member on the waitlist was promoted.' : 'Your booking was canceled.');
      }
      await loadClasses();
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : 'Could not update this booking.');
    } finally {
      setBusy('');
    }
  }

  const activeBookings = bookings.filter((booking) => booking.status === 'booked' || booking.status === 'waitlisted');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (sessionLoading || loading || !user || user.role !== 'member') {
    return <main className="flex min-h-screen items-center justify-center bg-[#F3EFE5] text-[#0B3D2E]">Loading class schedule...</main>;
  }

  return (
    <div className="min-h-screen bg-[#F3EFE5] md:flex">
      <Navigation userFullName={user.full_name} userRole={user.role} />
      <main className="min-w-0 flex-1 px-4 py-8 pb-24 md:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5A6660]">Member experience</p>
          <h1 className="mt-2 font-serif text-4xl text-[#0B3D2E]">Classes & bookings</h1>
          <p className="mt-2 text-sm text-[#5A6660]">Browse your gym’s weekly schedule, reserve a free member class, or join a waitlist.</p>
          {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

          <section className="mt-6 space-y-4">
            {classes.length === 0 && (
              <div className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-6 text-sm text-[#5A6660]">
                No classes are available. An active gym membership is required to browse the schedule.
              </div>
            )}
            {classes.map((classItem) => {
              const occurrenceDates = nextClassDates(classItem.day_of_week, 4);
              return (
                <article key={classItem.id} className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-serif text-2xl text-[#0B3D2E]">{classItem.name}</h2>
                        <span className="rounded-full bg-[#F2F7D9] px-2.5 py-1 text-xs font-semibold capitalize text-[#0B3D2E]">{classItem.class_type.replaceAll('_', ' ')}</span>
                      </div>
                      {classItem.description && <p className="mt-2 max-w-2xl text-sm text-[#5A6660]">{classItem.description}</p>}
                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#5A6660]">
                        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {dayNames[classItem.day_of_week]} · weekly</span>
                        <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" /> {classItem.start_time.slice(0, 5)} · {classItem.duration_minutes} min</span>
                        <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {classItem.gym_name}</span>
                        {classItem.trainer && <span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4" /> {classItem.trainer.full_name}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-sm font-semibold text-[#0B3D2E]">
                        {(classItem.price ?? 0) > 0 ? `ETB ${classItem.price}` : 'Included'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-5 divide-y divide-[#14201A]/10 border-t border-[#14201A]/10">
                    {occurrenceDates.map((bookingDate) => {
                      const booking = activeBookings.find((item) => item.class_id === classItem.id && item.booking_date === bookingDate);
                      const isBusy = busy === `${classItem.id}:${bookingDate}`;
                      return (
                        <div key={bookingDate} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <div>
                            <p className="text-sm font-semibold text-[#14201A]">{formatClassDate(bookingDate)}</p>
                            {classItem.capacity && <p className="mt-0.5 text-xs text-[#5A6660]">Capacity: {classItem.capacity}</p>}
                          </div>
                          {booking ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${booking.status === 'waitlisted' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{booking.status}</span>
                              <select
                                aria-label={`Reschedule booking from ${bookingDate}`}
                                defaultValue=""
                                disabled={isBusy}
                                onChange={(event) => {
                                  const targetDate = event.target.value;
                                  if (targetDate && window.confirm(`Reschedule your class to ${formatClassDate(targetDate)}?`)) {
                                    void changeBooking(classItem, bookingDate, 'reschedule', targetDate);
                                  }
                                  event.target.value = '';
                                }}
                                className="rounded-lg border border-[#14201A]/15 bg-white px-3 py-2 text-xs"
                              >
                                <option value="">Reschedule...</option>
                                {occurrenceDates.filter((date) => date !== bookingDate).map((date) => <option key={date} value={date}>{formatClassDate(date)}</option>)}
                              </select>
                              <button disabled={isBusy} type="button" onClick={() => void changeBooking(classItem, bookingDate, 'cancel')} className="rounded-lg border border-[#14201A]/15 px-3 py-2 text-xs font-semibold text-[#14201A] disabled:opacity-60">
                                {isBusy ? 'Working...' : 'Cancel'}
                              </button>
                            </div>
                          ) : (classItem.price ?? 0) > 0 ? (
                            <span className="max-w-48 text-right text-xs text-[#5A6660]">Paid class booking is handled at the gym for now.</span>
                          ) : (
                            <button disabled={isBusy} type="button" onClick={() => void changeBooking(classItem, bookingDate, 'book')} className="rounded-xl bg-[#0B3D2E] px-4 py-2.5 text-sm font-semibold text-[#F2F7D9] hover:bg-[#135440] disabled:opacity-60">
                              {isBusy ? 'Booking...' : 'Book class'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      </main>
    </div>
  );
}
