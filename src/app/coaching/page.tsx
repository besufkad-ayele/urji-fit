'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Navigation from '@/components/Navigation';
import MessageThread, { CoachingPartner } from '@/components/coaching/MessageThread';
import { useUserSession } from '@/hooks/useUserSession';

interface Exercise {
  id: string;
  name: string;
  target_sets: number;
  target_reps_min: number;
  target_reps_max: number;
  video_url: string | null;
  order_index: number;
}
interface CoachingProgram {
  id: string;
  name: string;
  description: string | null;
  nutrition_guidance: string | null;
  exercises: Exercise[];
}
interface PlanAssignment {
  id: string;
  gym_id: string;
  trainer_id: string;
  assigned_at: string;
  trainer: { id: string; full_name: string; avatar_url: string | null } | null;
  gym: { id: string; name: string } | null;
  program: CoachingProgram | CoachingProgram[] | null;
}
interface WorkoutLog {
  id: string;
  name: string;
  session_date: string;
  notes: string | null;
  exercise_sets: Array<{ id: string; exercise_name: string; set_number: number; weight_kg: number; reps: number; rpe: number | null }>;
}

function programOf(assignment: PlanAssignment): CoachingProgram | null {
  return Array.isArray(assignment.program) ? assignment.program[0] ?? null : assignment.program;
}

export default function MemberCoachingPage() {
  const { user, loading: sessionLoading } = useUserSession();
  const [plans, setPlans] = useState<PlanAssignment[]>([]);
  const [sessions, setSessions] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAssignmentId, setSavingAssignmentId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCoaching = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/member/coaching');
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.plans) || !Array.isArray(result.sessions)) {
        throw new Error(result.error || 'Could not load your coaching plans.');
      }
      setPlans(result.plans as PlanAssignment[]);
      setSessions(result.sessions as WorkoutLog[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your coaching plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load authenticated member data after the browser session has been checked.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!sessionLoading && user?.role === 'member') void loadCoaching();
  }, [sessionLoading, user, loadCoaching]);

  const partners = useMemo(() => {
    const byThread = new Map<string, CoachingPartner>();
    for (const plan of plans) {
      if (!plan.trainer || !plan.gym) continue;
      const key = `${plan.gym_id}:${plan.trainer_id}`;
      byThread.set(key, {
        id: plan.trainer_id,
        gymId: plan.gym_id,
        name: plan.trainer.full_name,
        relationship: plan.gym.name,
      });
    }
    return [...byThread.values()];
  }, [plans]);

  async function logWorkout(event: FormEvent<HTMLFormElement>, assignment: PlanAssignment, program: CoachingProgram) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const sets: Array<{ exercise_id: string; weight_kg: number; reps: number; rpe: number | null }> = [];
    for (const exercise of program.exercises) {
      for (let setNumber = 1; setNumber <= exercise.target_sets; setNumber += 1) {
        const weightValue = fields.get(`weight-${exercise.id}-${setNumber}`);
        const repsValue = fields.get(`reps-${exercise.id}-${setNumber}`);
        const rpeValue = fields.get(`rpe-${exercise.id}-${setNumber}`);
        if (typeof weightValue !== 'string' || typeof repsValue !== 'string') continue;
        sets.push({
          exercise_id: exercise.id,
          weight_kg: Number(weightValue),
          reps: Number(repsValue),
          rpe: typeof rpeValue === 'string' && rpeValue ? Number(rpeValue) : null,
        });
      }
    }
    setSavingAssignmentId(assignment.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/member/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignment.id,
          notes: fields.get('notes') ?? '',
          sets,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save workout.');
      setNotice('Workout saved to your training history.');
      form.reset();
      await loadCoaching();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save workout.');
    } finally {
      setSavingAssignmentId('');
    }
  }

  if (sessionLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F3EFE5] text-[#0B3D2E]">Loading your coaching workspace…</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#F3EFE5]">
      <Navigation userFullName={user?.full_name} userRole={user?.role} />
      <main className="mx-auto min-w-0 max-w-6xl flex-1 space-y-7 p-5 pb-24 md:p-10 md:pb-10">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0B3D2E]">Your coaching</p>
          <h1 className="mt-1 font-serif text-4xl text-[#14201A]">Plans & progress</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5A6660]">View your coach’s program, record workout sets, review your training history, and message your trainer.</p>
        </header>
        {error && <p role="alert" className="rounded-xl bg-[#FBE9E1] px-4 py-3 text-sm text-[#8E341E]">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-[#F2F7D9] px-4 py-3 text-sm text-[#0B3D2E]">{notice}</p>}
        {!plans.length ? <section className="rounded-3xl border border-[#14201A]/10 bg-[#FCFAF6] p-6 text-sm text-[#5A6660]">You don’t have a coach-assigned program yet. Once your trainer assigns one, it will appear here. You can continue using the regular workout tracker in the meantime.</section> :
          <section className="space-y-4">
            {plans.map((assignment) => {
              const program = programOf(assignment);
              if (!program) return null;
              const exercises = [...program.exercises].sort((a, b) => a.order_index - b.order_index);
              return (
                <article key={assignment.id} className="rounded-3xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0B3D2E]">{assignment.gym?.name ?? 'Your gym'}</p>
                      <h2 className="mt-1 font-serif text-2xl text-[#14201A]">{program.name}</h2>
                      <p className="mt-1 text-sm text-[#5A6660]">Coach: {assignment.trainer?.full_name ?? 'Your trainer'}</p>
                    </div>
                    <span className="rounded-full bg-[#F2F7D9] px-3 py-1 text-xs font-semibold text-[#0B3D2E]">Active plan</span>
                  </div>
                  {program.description && <p className="mt-4 text-sm leading-6 text-[#5A6660]">{program.description}</p>}
                  {program.nutrition_guidance && <p className="mt-4 rounded-2xl bg-[#F2F7D9]/70 p-4 text-sm leading-6 text-[#14201A]"><span className="font-semibold">Nutrition guidance: </span>{program.nutrition_guidance}</p>}
                  <div className="mt-4 space-y-3">
                    {exercises.map((exercise) => (
                      <section key={exercise.id} className="rounded-2xl bg-[#F3EFE5]/70 p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="font-semibold text-[#14201A]">{exercise.name}</h3>
                          <p className="text-xs text-[#5A6660]">{exercise.target_sets} sets · {exercise.target_reps_min}–{exercise.target_reps_max} reps</p>
                        </div>
                        {exercise.video_url && <a href={exercise.video_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-[#0B3D2E] underline">Watch exercise demo</a>}
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {Array.from({ length: exercise.target_sets }, (_, index) => {
                            const setNumber = index + 1;
                            return <div key={setNumber} className="grid grid-cols-3 gap-2 rounded-xl bg-white p-2.5">
                              <span className="col-span-3 text-[10px] font-bold uppercase tracking-wider text-[#5A6660]">Set {setNumber}</span>
                              <label className="text-[10px] font-semibold text-[#5A6660]">Weight kg
                                <input required type="number" min="0" max="1000" step="0.25" name={`weight-${exercise.id}-${setNumber}`} defaultValue="0" className="mt-1 w-full rounded-lg border border-[#14201A]/15 px-2 py-1.5 text-sm text-[#14201A]" />
                              </label>
                              <label className="text-[10px] font-semibold text-[#5A6660]">Reps
                                <input required type="number" min="1" max="1000" name={`reps-${exercise.id}-${setNumber}`} defaultValue={exercise.target_reps_max} className="mt-1 w-full rounded-lg border border-[#14201A]/15 px-2 py-1.5 text-sm text-[#14201A]" />
                              </label>
                              <label className="text-[10px] font-semibold text-[#5A6660]">RPE
                                <input type="number" min="1" max="10" step="0.5" name={`rpe-${exercise.id}-${setNumber}`} placeholder="Optional" className="mt-1 w-full rounded-lg border border-[#14201A]/15 px-2 py-1.5 text-sm text-[#14201A]" />
                              </label>
                            </div>;
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                  <form onSubmit={(event) => void logWorkout(event, assignment, program)} className="mt-4 space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#5A6660]">Session notes
                      <textarea name="notes" rows={2} maxLength={2000} placeholder="How did the session feel? Any pain or difficulty to share with your coach?" className="mt-1 block w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 text-sm font-normal normal-case text-[#14201A]" />
                    </label>
                    <button disabled={savingAssignmentId === assignment.id} className="rounded-xl bg-[#0B3D2E] px-4 py-3 text-sm font-semibold text-[#F2F7D9] disabled:opacity-60">
                      {savingAssignmentId === assignment.id ? 'Saving workout…' : 'Save completed workout'}
                    </button>
                  </form>
                </article>
              );
            })}
          </section>}

        <section className="rounded-3xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm md:p-6">
          <h2 className="font-serif text-2xl text-[#14201A]">Workout history</h2>
          {!sessions.length ? <p className="mt-3 text-sm text-[#5A6660]">Your coach-program workout logs will appear here after your first session.</p> :
            <div className="mt-4 space-y-3">
              {sessions.map((session) => <article key={session.id} className="rounded-2xl bg-[#F3EFE5]/70 p-4">
                <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{session.name}</h3><time className="text-xs text-[#5A6660]">{session.session_date}</time></div>
                {session.notes && <p className="mt-1 text-sm text-[#5A6660]">{session.notes}</p>}
                <div className="mt-2 flex flex-wrap gap-2">{session.exercise_sets.map((set) => <span key={set.id} className="rounded-lg bg-white px-2 py-1 text-xs">{set.exercise_name}: {set.weight_kg} kg × {set.reps} · RPE {set.rpe ?? '—'}</span>)}</div>
              </article>)}
            </div>}
        </section>
        {user && <MessageThread currentUserId={user.id} partners={partners} />}
      </main>
    </div>
  );
}
