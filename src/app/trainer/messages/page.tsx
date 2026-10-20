'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import MessageThread, { CoachingPartner } from '@/components/coaching/MessageThread';
import { useUserSession } from '@/hooks/useUserSession';

interface TrainerClientAssignment {
  id: string;
  gym_id: string;
  client_id: string;
  client: { id: string; full_name: string } | Array<{ id: string; full_name: string }> | null;
  gym: { id: string; name: string } | null;
}

function clientOf(assignment: TrainerClientAssignment) {
  return Array.isArray(assignment.client) ? assignment.client[0] ?? null : assignment.client;
}

export default function TrainerMessagesPage() {
  const { user, loading: sessionLoading } = useUserSession();
  const [assignments, setAssignments] = useState<TrainerClientAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/trainer/programs');
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.assignments)) {
        throw new Error(result.error || 'Could not load active clients.');
      }
      setAssignments(result.assignments as TrainerClientAssignment[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load active clients.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load assigned clients after the signed trainer session has been verified.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!sessionLoading && user?.role === 'trainer') void loadAssignments();
  }, [sessionLoading, user, loadAssignments]);

  const partners = useMemo(() => {
    const unique = new Map<string, CoachingPartner>();
    for (const assignment of assignments) {
      const client = clientOf(assignment);
      if (!client || !assignment.gym) continue;
      const key = `${assignment.gym_id}:${assignment.client_id}`;
      unique.set(key, {
        id: assignment.client_id,
        gymId: assignment.gym_id,
        name: client.full_name,
        relationship: assignment.gym.name,
      });
    }
    return [...unique.values()];
  }, [assignments]);

  if (sessionLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F3EFE5] text-[#0B3D2E]">Loading coaching messages…</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#F3EFE5]">
      <Navigation userFullName={user?.full_name} userRole={user?.role} />
      <main className="mx-auto min-w-0 max-w-5xl flex-1 space-y-6 p-5 pb-24 md:p-10 md:pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0B3D2E]">Coach workspace</p>
            <h1 className="mt-1 font-serif text-4xl text-[#14201A]">Client messages</h1>
            <p className="mt-2 text-sm text-[#5A6660]">Keep coaching conversations connected to your active client assignments.</p>
          </div>
          <Link href="/trainer" className="rounded-xl border border-[#14201A]/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#0B3D2E]">Coach dashboard</Link>
        </header>
        {error && <p role="alert" className="rounded-xl bg-[#FBE9E1] px-4 py-3 text-sm text-[#8E341E]">{error}</p>}
        {user && <MessageThread currentUserId={user.id} partners={partners} />}
      </main>
    </div>
  );
}
