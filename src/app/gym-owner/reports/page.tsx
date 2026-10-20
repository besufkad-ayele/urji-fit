'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, Bell, Download, FileSpreadsheet, LoaderCircle, Megaphone, RefreshCw, TrendingUp, Users } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';

interface GymOption {
  id: string;
  name: string;
}
interface ReportData {
  range: { from: string; to: string };
  summary: {
    active_members: number;
    new_memberships: number;
    canceled_memberships: number;
    renewal_risk_members: number;
    inactive_members_14_days: number;
    attendance_visits: number;
    completed_payments_etb: number;
    pos_sales_etb: number;
    total_cash_revenue_etb: number;
    failed_payments: number;
    invoices_issued_etb: number;
    outstanding_invoices_etb: number;
    class_utilization_percent: number;
  };
  revenue_by_day: { date: string; amount_etb: number }[];
  attendance_by_day: { date: string; visits: number }[];
  class_bookings: { booked: number; attended: number; no_show: number; waitlisted: number };
  trainer_performance: { trainer_id: string; trainer_name: string; attended: number }[];
  at_risk_members: { member_id: string; full_name: string; email: string | null; membership_end_date: string | null }[];
}
interface Commission {
  id: string;
  booking_id: string;
  trainer_id: string;
  amount: number;
  status: 'accrued' | 'paid' | 'void';
  note: string | null;
  created_at: string;
  paid_at: string | null;
  trainer: { full_name: string } | Array<{ full_name: string }> | null;
  booking: {
    booking_date: string;
    class: { name: string } | Array<{ name: string }> | null;
    member: { full_name: string } | Array<{ full_name: string }> | null;
  } | Array<{
    booking_date: string;
    class: { name: string } | Array<{ name: string }> | null;
    member: { full_name: string } | Array<{ full_name: string }> | null;
  }> | null;
}
interface EligibleSession {
  id: string;
  booking_date: string;
  class: { name: string; trainer_id: string } | Array<{ name: string; trainer_id: string }> | null;
  member: { full_name: string } | Array<{ full_name: string }> | null;
}
interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author: { full_name: string } | Array<{ full_name: string }> | null;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatEtb(amount: number) {
  return `ETB ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function GymReportsPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useUserSession();
  const [gyms, setGyms] = useState<GymOption[]>([]);
  const [gymId, setGymId] = useState('');
  const [from, setFrom] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<ReportData | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [eligibleSessions, setEligibleSessions] = useState<EligibleSession[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeTab, setActiveTab] = useState<'reports' | 'commissions' | 'announcements'>('reports');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const queryString = useMemo(() => new URLSearchParams({ from, to }).toString(), [from, to]);

  const loadData = useCallback(async (targetGymId: string) => {
    if (!targetGymId) return;
    setLoading(true);
    setError('');
    try {
      const [reportResponse, commissionResponse, announcementResponse] = await Promise.all([
        fetch(`/api/gyms/${targetGymId}/reports?${queryString}`),
        fetch(`/api/gyms/${targetGymId}/commissions`),
        fetch(`/api/gyms/${targetGymId}/announcements`),
      ]);
      const [reportResult, commissionResult, announcementResult] = await Promise.all([
        reportResponse.json(), commissionResponse.json(), announcementResponse.json(),
      ]);
      if (!reportResponse.ok) throw new Error(reportResult.error || 'Could not load gym reports.');
      if (!commissionResponse.ok) throw new Error(commissionResult.error || 'Could not load trainer commissions.');
      if (!announcementResponse.ok) throw new Error(announcementResult.error || 'Could not load announcements.');
      setReport(reportResult as ReportData);
      setCommissions(commissionResult.commissions as Commission[]);
      setEligibleSessions(commissionResult.eligible_sessions as EligibleSession[]);
      setAnnouncements(announcementResult.announcements as Announcement[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load business reporting.');
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    let current = true;
    void (async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/gyms/managed');
        const result = await response.json();
        if (!response.ok || !Array.isArray(result.gyms)) throw new Error(result.error || 'Could not find gyms for reporting.');
        if (!current) return;
        setGyms(result.gyms);
        setGymId((existing) => existing || result.gyms[0]?.id || '');
        if (!result.gyms.length) setLoading(false);
      } catch (loadError) {
        if (current) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load your gyms.');
          setLoading(false);
        }
      }
    })();
    return () => { current = false; };
  }, [sessionLoading, user, router]);

  useEffect(() => {
    // Refresh reports when the selected gym or range changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (gymId) void loadData(gymId);
  }, [gymId, loadData]);

  async function recordCommission(bookingId: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/gyms/${gymId}/commissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, amount: Number(amounts[bookingId]), note: notes[bookingId] || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not record commission.');
      setNotice('Commission recorded. This is an internal ledger entry, not a payment transfer.');
      setAmounts((current) => ({ ...current, [bookingId]: '' }));
      await loadData(gymId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not record commission.');
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(commissionId: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/gyms/${gymId}/commissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commission_id: commissionId, status: 'paid' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not record payout.');
      setNotice('Payout marked paid in the ledger; no funds were moved by Urji Fit.');
      await loadData(gymId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not record payout.');
    } finally {
      setBusy(false);
    }
  }

  async function publishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/gyms/${gymId}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: announcementTitle, body: announcementBody }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not publish announcement.');
      setNotice(`Announcement added to ${result.recipient_count} active member inbox(es). No external messages were sent.`);
      setAnnouncementTitle('');
      setAnnouncementBody('');
      await loadData(gymId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not publish announcement.');
    } finally {
      setBusy(false);
    }
  }

  if (sessionLoading || loading && !gyms.length) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F3EFE5] text-[#0B3D2E]"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading business reports…</div>;
  }

  const summaryCards = report ? [
    ['Active members', report.summary.active_members, `${report.summary.new_memberships} new memberships`],
    ['Paid revenue', formatEtb(report.summary.total_cash_revenue_etb), `${formatEtb(report.summary.completed_payments_etb)} payments · ${formatEtb(report.summary.pos_sales_etb)} POS`],
    ['Attendance visits', report.summary.attendance_visits, `${report.class_bookings.attended} class visits attended`],
    ['Inactive members', report.summary.inactive_members_14_days, `${report.summary.renewal_risk_members} members near renewal`],
  ] as const : [];

  return (
    <div className="min-h-screen bg-[#F3EFE5] text-[#14201A] lg:flex">
      <Navigation userFullName={user?.full_name} userRole={user?.role} />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 pb-28 pt-8 md:px-8 lg:px-10">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5A6660]">Phase 4 · business intelligence</p>
            <h1 className="mt-2 font-serif text-4xl text-[#0B3D2E]">Reports & engagement</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#5A6660]">Review verified ETB collections, attendance, member retention signals, trainer activity, and in-app member engagement.</p>
          </div>
          <Link href="/gym-owner/operations" className="text-sm font-semibold text-[#0B3D2E] underline-offset-4 hover:underline">Back to operations</Link>
        </header>

        <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-4">
          <label className="min-w-52 flex-1 text-xs font-semibold text-[#5A6660]">Gym
            <select value={gymId} onChange={(event) => setGymId(event.target.value)} className="mt-1 block w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm text-[#14201A]">
              {gyms.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#5A6660]">From
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm text-[#14201A]" />
          </label>
          <label className="text-xs font-semibold text-[#5A6660]">To
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm text-[#14201A]" />
          </label>
          <button type="button" onClick={() => void loadData(gymId)} disabled={loading || !gymId} className="inline-flex items-center gap-2 rounded-xl bg-[#0B3D2E] px-4 py-2.5 text-sm font-semibold text-[#F2F7D9] disabled:opacity-50">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </button>
          {(['payments', 'invoices', 'attendance', 'trainer-performance', 'members', 'commissions', 'inventory', 'pos'] as const).map((dataset) => (
            <a key={dataset} href={`/api/gyms/${gymId}/reports/export?dataset=${dataset}&${queryString}`} className="inline-flex items-center gap-1 rounded-xl border border-[#0B3D2E]/20 px-3 py-2.5 text-xs font-semibold capitalize text-[#0B3D2E] hover:bg-[#F2F7D9]">
              <Download className="h-3.5 w-3.5" />{dataset}
            </a>
          ))}
        </section>

        {error && <div role="alert" className="rounded-xl border border-[#C1502E]/30 bg-[#C1502E]/10 p-3 text-sm text-[#8D351F]">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-[#0B3D2E]/20 bg-[#F2F7D9] p-3 text-sm text-[#0B3D2E]">{notice}</div>}

        <div className="flex flex-wrap gap-2">
          {([
            ['reports', 'Business reports', FileSpreadsheet],
            ['commissions', 'Trainer commissions', TrendingUp],
            ['announcements', 'Member announcements', Megaphone],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setActiveTab(id)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${activeTab === id ? 'bg-[#0B3D2E] text-[#F2F7D9]' : 'bg-white text-[#5A6660]'}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        {activeTab === 'reports' && report && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map(([title, value, detail], index) => (
                <article key={title} className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                  <div className="flex items-center justify-between text-sm text-[#5A6660]"><span>{title}</span>{index === 0 ? <Users className="h-4 w-4" /> : index === 1 ? <TrendingUp className="h-4 w-4" /> : index === 2 ? <Activity className="h-4 w-4" /> : <Bell className="h-4 w-4" />}</div>
                  <p className="mt-3 font-serif text-3xl text-[#0B3D2E]">{value}</p>
                  <p className="mt-1 text-xs text-[#5A6660]">{detail}</p>
                </article>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Invoices issued', formatEtb(report.summary.invoices_issued_etb), 'Invoice total in selected period'],
                ['Outstanding balance', formatEtb(report.summary.outstanding_invoices_etb), 'Unpaid and overdue invoice balances'],
                ['New / canceled', `${report.summary.new_memberships} / ${report.summary.canceled_memberships}`, 'Membership records in selected period'],
                ['Failed payments', report.summary.failed_payments, 'Failed transaction records in selected period'],
              ].map(([title, value, detail]) => <article key={title} className="rounded-xl border border-[#14201A]/10 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#5A6660]">{title}</p><p className="mt-2 text-xl font-bold text-[#0B3D2E]">{value}</p><p className="mt-1 text-xs text-[#5A6660]">{detail}</p>
              </article>)}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                <h2 className="font-serif text-2xl text-[#0B3D2E]">Daily collected revenue</h2>
                <p className="mb-4 text-xs text-[#5A6660]">Completed manual payments plus completed cash POS sales; pending receipts are excluded.</p>
                <div className="max-h-80 space-y-2 overflow-auto">
                  {report.revenue_by_day.length ? report.revenue_by_day.map((day) => {
                    const max = Math.max(...report.revenue_by_day.map((entry) => entry.amount_etb), 1);
                    return <div key={day.date} className="grid grid-cols-[90px_1fr_110px] items-center gap-2 text-xs">
                      <span className="text-[#5A6660]">{day.date}</span>
                      <div className="h-2 overflow-hidden rounded-full bg-[#F2F7D9]"><div className="h-full rounded-full bg-[#0B3D2E]" style={{ width: `${Math.max(2, day.amount_etb / max * 100)}%` }} /></div>
                      <span className="text-right font-semibold">{formatEtb(day.amount_etb)}</span>
                    </div>;
                  }) : <p className="rounded-xl bg-white p-4 text-sm text-[#5A6660]">No completed collections in this period.</p>}
                </div>
              </section>
              <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                <h2 className="font-serif text-2xl text-[#0B3D2E]">Attendance trend</h2>
                <p className="mb-4 text-xs text-[#5A6660]">Recorded gym and class check-ins by day.</p>
                <div className="max-h-80 space-y-2 overflow-auto">
                  {report.attendance_by_day.length ? report.attendance_by_day.map((day) => {
                    const max = Math.max(...report.attendance_by_day.map((entry) => entry.visits), 1);
                    return <div key={day.date} className="grid grid-cols-[90px_1fr_32px] items-center gap-2 text-xs">
                      <span className="text-[#5A6660]">{day.date}</span>
                      <div className="h-2 overflow-hidden rounded-full bg-[#F2F7D9]"><div className="h-full rounded-full bg-[#0B3D2E]" style={{ width: `${Math.max(2, day.visits / max * 100)}%` }} /></div>
                      <span className="text-right font-semibold">{day.visits}</span>
                    </div>;
                  }) : <p className="rounded-xl bg-white p-4 text-sm text-[#5A6660]">No recorded attendance in this period.</p>}
                </div>
              </section>
              <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
                <h2 className="font-serif text-2xl text-[#0B3D2E]">Class & trainer activity</h2>
                <p className="mt-1 text-sm text-[#5A6660]">Scheduled capacity utilization: <strong>{report.summary.class_utilization_percent}%</strong></p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-white p-3">Bookings <strong className="float-right">{report.class_bookings.booked}</strong></div>
                  <div className="rounded-xl bg-white p-3">Attended <strong className="float-right">{report.class_bookings.attended}</strong></div>
                  <div className="rounded-xl bg-white p-3">No-shows <strong className="float-right">{report.class_bookings.no_show}</strong></div>
                  <div className="rounded-xl bg-white p-3">Waitlisted <strong className="float-right">{report.class_bookings.waitlisted}</strong></div>
                </div>
                <h3 className="mt-5 text-sm font-bold">Trainer attendance</h3>
                {report.trainer_performance.length ? report.trainer_performance.map((trainer) => (
                  <div key={trainer.trainer_id} className="mt-2 flex justify-between rounded-lg bg-white px-3 py-2 text-sm"><span>{trainer.trainer_name}</span><span className="font-semibold">{trainer.attended} attended</span></div>
                )) : <p className="mt-2 text-sm text-[#5A6660]">No class attendance in this period.</p>}
              </section>
            </div>

            <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
              <h2 className="font-serif text-2xl text-[#0B3D2E]">Retention watchlist</h2>
              <p className="mb-3 text-xs text-[#5A6660]">Members with active memberships and no attendance record during the last 14 days, plus memberships expiring within 30 days.</p>
              {report.at_risk_members.length ? <div className="grid gap-2 md:grid-cols-2">
                {report.at_risk_members.map((member) => <div key={member.member_id} className="flex justify-between gap-3 rounded-xl bg-white p-3 text-sm"><div><p className="font-semibold">{member.full_name}</p><p className="text-xs text-[#5A6660]">{member.email || 'No email on file'}</p></div><span className="text-right text-xs text-[#C1502E]">{member.membership_end_date ? `Ends ${member.membership_end_date}` : 'No recent visit'}</span></div>)}
              </div> : <p className="text-sm text-[#5A6660]">No active members currently meet the 14-day inactivity rule.</p>}
            </section>
          </div>
        )}

        {activeTab === 'commissions' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#C1502E]/20 bg-[#FBE9E1] p-4 text-sm text-[#73331F]">
              Managers manually enter ETB commission amounts for attended sessions. Marking a record paid updates the ledger only—it does not transfer money or create a bank payment.
            </div>
            <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
              <h2 className="font-serif text-2xl text-[#0B3D2E]">Record attended-session commission</h2>
              <div className="mt-4 space-y-3">
                {eligibleSessions.map((session) => {
                  const gymClass = one(session.class);
                  const member = one(session.member);
                  return <div key={session.id} className="grid gap-2 rounded-xl bg-white p-3 md:grid-cols-[1fr_150px_1fr_auto] md:items-center">
                    <div className="text-sm"><strong>{gymClass?.name ?? 'Class'}</strong><span className="block text-xs text-[#5A6660]">{member?.full_name ?? 'Member'} · {session.booking_date}</span></div>
                    <input aria-label={`Commission amount for ${member?.full_name ?? 'member'}`} type="number" min="0.01" step="0.01" placeholder="Amount (ETB)" value={amounts[session.id] ?? ''} onChange={(event) => setAmounts((current) => ({ ...current, [session.id]: event.target.value }))} className="rounded-lg border border-[#14201A]/15 px-3 py-2 text-sm" />
                    <input aria-label="Commission note" maxLength={500} placeholder="Optional note" value={notes[session.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [session.id]: event.target.value }))} className="rounded-lg border border-[#14201A]/15 px-3 py-2 text-sm" />
                    <button disabled={busy || !Number(amounts[session.id])} onClick={() => void recordCommission(session.id)} className="rounded-lg bg-[#0B3D2E] px-3 py-2 text-sm font-semibold text-[#F2F7D9] disabled:opacity-50">Record</button>
                  </div>;
                })}
                {!eligibleSessions.length && <p className="text-sm text-[#5A6660]">No unrecorded attended sessions are available.</p>}
              </div>
            </section>
            <section className="overflow-x-auto rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
              <h2 className="font-serif text-2xl text-[#0B3D2E]">Commission & payout ledger</h2>
              <table className="mt-4 w-full min-w-[700px] text-left text-sm">
                <thead className="text-xs uppercase text-[#5A6660]"><tr><th className="p-2">Trainer / session</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Recorded</th><th className="p-2">Action</th></tr></thead>
                <tbody>{commissions.map((commission) => {
                  const booking = one(commission.booking);
                  const sessionClass = one(booking?.class);
                  const member = one(booking?.member);
                  const trainer = one(commission.trainer);
                  return <tr key={commission.id} className="border-t border-[#14201A]/10">
                    <td className="p-2"><strong>{trainer?.full_name ?? 'Trainer'}</strong><span className="block text-xs text-[#5A6660]">{sessionClass?.name ?? 'Session'} · {member?.full_name ?? 'Member'}</span></td>
                    <td className="p-2">{formatEtb(Number(commission.amount))}</td><td className="p-2 capitalize">{commission.status}</td>
                    <td className="p-2">{new Date(commission.created_at).toLocaleDateString()}</td>
                    <td className="p-2">{commission.status === 'accrued' ? <button disabled={busy} onClick={() => void markPaid(commission.id)} className="rounded-lg border border-[#0B3D2E]/20 px-3 py-1.5 text-xs font-semibold text-[#0B3D2E]">Mark paid</button> : commission.paid_at ? <span className="text-xs text-[#5A6660]">{new Date(commission.paid_at).toLocaleDateString()}</span> : '—'}</td>
                  </tr>;
                })}</tbody>
              </table>
              {!commissions.length && <p className="mt-3 text-sm text-[#5A6660]">No commissions recorded yet.</p>}
            </section>
          </div>
        )}

        {activeTab === 'announcements' && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <form onSubmit={publishAnnouncement} className="space-y-4 rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
              <h2 className="font-serif text-2xl text-[#0B3D2E]">Publish to member inboxes</h2>
              <label className="block text-sm font-semibold">Title<input required maxLength={120} value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} className="mt-1 block w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" /></label>
              <label className="block text-sm font-semibold">Announcement<textarea required maxLength={4000} rows={6} value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} className="mt-1 block w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" /></label>
              <button disabled={busy || !gymId} className="rounded-xl bg-[#0B3D2E] px-4 py-2.5 text-sm font-semibold text-[#F2F7D9] disabled:opacity-50">Publish in app</button>
              <p className="text-xs text-[#5A6660]">Only active members receive the in-app notice. Email, SMS, WhatsApp, and push delivery require a configured provider and are not sent by this action.</p>
            </form>
            <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
              <h2 className="font-serif text-2xl text-[#0B3D2E]">Recent announcements</h2>
              <div className="mt-4 space-y-3">{announcements.map((item) => <article key={item.id} className="rounded-xl bg-white p-4">
                <div className="flex justify-between gap-3"><h3 className="font-semibold">{item.title}</h3><span className="shrink-0 text-xs text-[#5A6660]">{new Date(item.created_at).toLocaleDateString()}</span></div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#5A6660]">{item.body}</p>
                <p className="mt-2 text-xs text-[#5A6660]">By {one(item.author)?.full_name ?? 'Gym staff'}</p>
              </article>)}
                {!announcements.length && <p className="text-sm text-[#5A6660]">No announcements have been published.</p>}
              </div>
            </section>
          </div>
        )}

        <footer className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-4 text-xs leading-5 text-[#5A6660]">
          Export controls are limited to authorized gym owners/managers. POS cash sales and manually verified payment records are reported separately and combined only for the collected-revenue total. No automated charge, commission transfer, or external campaign delivery is implied.
        </footer>
      </main>
    </div>
  );
}
