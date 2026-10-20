'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, TrendingUp } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';

interface TrainerCommission {
  id: string;
  amount: number;
  currency: string;
  status: string;
  note: string | null;
  created_at: string;
  paid_at: string | null;
  gym: { name: string } | Array<{ name: string }> | null;
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

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function TrainerEarningsPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useUserSession();
  const [items, setItems] = useState<TrainerCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/trainer/commissions');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load your commission ledger.');
      setItems(result.commissions as TrainerCommission[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your commission ledger.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load earnings only after verifying the trainer session on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!sessionLoading && user?.role === 'trainer') void load();
    else if (!sessionLoading) router.replace('/dashboard');
  }, [sessionLoading, user, load, router]);

  if (sessionLoading || !user) return <div className="flex min-h-screen items-center justify-center bg-[#F3EFE5] text-[#0B3D2E]"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading trainer account…</div>;
  const accrued = items.filter((item) => item.status === 'accrued').reduce((sum, item) => sum + Number(item.amount), 0);
  const paid = items.filter((item) => item.status === 'paid').reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="min-h-screen bg-[#F3EFE5] text-[#14201A] lg:flex">
      <Navigation userFullName={user.full_name} userRole={user.role} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 pb-28 pt-8 md:px-8">
        <header><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5A6660]">Trainer workspace</p><h1 className="mt-2 font-serif text-4xl text-[#0B3D2E]">Commission ledger</h1><p className="mt-2 text-sm text-[#5A6660]">Review commission amounts recorded by your gym manager.</p></header>
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5"><p className="text-sm text-[#5A6660]">Accrued, not yet marked paid</p><p className="mt-2 font-serif text-3xl text-[#0B3D2E]">ETB {accrued.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></article>
          <article className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5"><p className="text-sm text-[#5A6660]">Marked paid</p><p className="mt-2 font-serif text-3xl text-[#0B3D2E]">ETB {paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p></article>
        </div>
        {error && <div role="alert" className="rounded-xl border border-[#C1502E]/30 bg-[#C1502E]/10 p-3 text-sm text-[#8D351F]">{error}</div>}
        <section className="overflow-x-auto rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-5">
          <h2 className="flex items-center gap-2 font-serif text-2xl text-[#0B3D2E]"><TrendingUp className="h-5 w-5" />Session commissions</h2>
          {loading ? <p className="mt-4 flex items-center gap-2 text-sm text-[#5A6660]"><LoaderCircle className="h-4 w-4 animate-spin" />Loading ledger…</p> : items.length ? <table className="mt-4 w-full min-w-[650px] text-left text-sm">
            <thead className="text-xs uppercase text-[#5A6660]"><tr><th className="p-2">Gym / class</th><th className="p-2">Member</th><th className="p-2">Session date</th><th className="p-2">ETB amount</th><th className="p-2">Status</th></tr></thead>
            <tbody>{items.map((item) => {
              const booking = one(item.booking);
              return <tr key={item.id} className="border-t border-[#14201A]/10">
                <td className="p-2">{one(item.gym)?.name ?? 'Gym'}<span className="block text-xs text-[#5A6660]">{one(booking?.class)?.name ?? 'Session'}</span></td>
                <td className="p-2">{one(booking?.member)?.full_name ?? 'Member'}{item.note && <span className="block text-xs text-[#5A6660]">{item.note}</span>}</td>
                <td className="p-2">{booking?.booking_date ?? '—'}</td><td className="p-2">{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-2 capitalize">{item.status}{item.paid_at && <span className="block text-xs text-[#5A6660]">{new Date(item.paid_at).toLocaleDateString()}</span>}</td>
              </tr>;
            })}</tbody>
          </table> : <p className="mt-4 text-sm text-[#5A6660]">Your gym has not recorded any session commissions yet.</p>}
        </section>
        <p className="rounded-xl border border-[#C1502E]/20 bg-[#FBE9E1] p-4 text-xs leading-5 text-[#73331F]">The ledger shows amounts manually entered by management. “Paid” is a record status only; Urji Fit does not transfer funds or independently verify a payout.</p>
      </main>
    </div>
  );
}
