'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Check, LoaderCircle, RefreshCw } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';

interface NotificationItem {
  id: string;
  category: string;
  title: string;
  body: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
  gym: { name: string } | Array<{ name: string }> | null;
}

function gymName(value: NotificationItem['gym']) {
  return (Array.isArray(value) ? value[0] : value)?.name ?? 'Urji Fit';
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useUserSession();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/notifications');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load notifications.');
      setItems(result.notifications as NotificationItem[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load the signed-in user's inbox after session hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!sessionLoading && user) void loadNotifications();
    else if (!sessionLoading && !user) router.replace('/login');
  }, [sessionLoading, user, loadNotifications, router]);

  async function markRead(id: string) {
    setBusyId(id);
    setError('');
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update notification.');
      setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update notification.');
    } finally {
      setBusyId('');
    }
  }

  if (sessionLoading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F3EFE5] text-[#0B3D2E]"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading your inbox…</div>;
  }

  const unreadCount = items.filter((item) => !item.read_at).length;
  return (
    <div className="min-h-screen bg-[#F3EFE5] text-[#14201A] lg:flex">
      <Navigation userFullName={user.full_name} userRole={user.role} />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 pb-28 pt-8 md:px-8">
        <header className="flex items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5A6660]">Member updates</p><h1 className="mt-2 font-serif text-4xl text-[#0B3D2E]">Inbox</h1><p className="mt-2 text-sm text-[#5A6660]">{unreadCount} unread notification{unreadCount === 1 ? '' : 's'}</p></div>
          <button onClick={() => void loadNotifications()} className="inline-flex items-center gap-2 rounded-xl border border-[#14201A]/10 bg-[#FCFAF6] px-3 py-2 text-sm font-semibold"><RefreshCw className="h-4 w-4" /> Refresh</button>
        </header>
        {error && <div role="alert" className="rounded-xl border border-[#C1502E]/30 bg-[#C1502E]/10 p-3 text-sm text-[#8D351F]">{error}</div>}
        {loading ? <div className="flex items-center gap-2 rounded-2xl bg-[#FCFAF6] p-6 text-sm text-[#5A6660]"><LoaderCircle className="h-4 w-4 animate-spin" />Loading notifications…</div> :
          items.length ? <div className="space-y-3">{items.map((item) => {
            const destination = item.action_url?.startsWith('/') && !item.action_url.startsWith('//') ? item.action_url : null;
            return <article key={item.id} className={`rounded-2xl border p-5 ${item.read_at ? 'border-[#14201A]/10 bg-[#FCFAF6]' : 'border-[#0B3D2E]/20 bg-[#F2F7D9]'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="flex items-center gap-2"><Bell className="h-4 w-4 text-[#0B3D2E]" /><h2 className="font-semibold">{item.title}</h2>{!item.read_at && <span className="rounded-full bg-[#0B3D2E] px-2 py-0.5 text-[10px] font-bold uppercase text-[#F2F7D9]">New</span>}</div>
                  <p className="mt-1 text-xs text-[#5A6660]">{gymName(item.gym)} · {new Date(item.created_at).toLocaleString()} · {item.category.replaceAll('_', ' ')}</p></div>
                {!item.read_at && <button disabled={busyId === item.id} onClick={() => void markRead(item.id)} className="inline-flex items-center gap-1 rounded-lg border border-[#0B3D2E]/20 px-3 py-1.5 text-xs font-semibold text-[#0B3D2E] disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Mark read</button>}
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{item.body}</p>
              {destination && <Link href={destination} onClick={() => { if (!item.read_at) void markRead(item.id); }} className="mt-3 inline-block text-sm font-semibold text-[#0B3D2E] underline underline-offset-4">Open</Link>}
            </article>;
          })}</div> : <section className="rounded-2xl border border-[#14201A]/10 bg-[#FCFAF6] p-8 text-center"><Bell className="mx-auto h-8 w-8 text-[#5A6660]" /><h2 className="mt-3 font-serif text-2xl text-[#0B3D2E]">You’re all caught up</h2><p className="mt-2 text-sm text-[#5A6660]">Gym announcements and membership reminders will appear here.</p></section>}
      </main>
    </div>
  );
}
