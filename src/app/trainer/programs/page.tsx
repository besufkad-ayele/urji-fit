'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';

interface GymChoice {
  id: string;
  name: string;
}
interface TrainerClientAssignment {
  id: string;
  gym_id: string;
  client_id: string;
  client: { id: string; full_name: string; email: string | null } | Array<{ id: string; full_name: string; email: string | null }> | null;
  gym: GymChoice | null;
}
interface ProgramExercise {
  id: string;
  name: string;
  target_sets: number;
  target_reps_min: number;
  target_reps_max: number;
  video_url: string | null;
  order_index: number;
}
interface TrainerProgram {
  id: string;
  gym_id: string;
  name: string;
  description: string | null;
  nutrition_guidance: string | null;
  status: string;
  exercises: ProgramExercise[];
  assignments: Array<{ id: string; client_id: string; status: string }>;
}
interface WorkoutLog {
  id: string;
  user_id: string;
  name: string;
  session_date: string;
  notes: string | null;
  exercise_sets: Array<{ exercise_name: string; set_number: number; weight_kg: number; reps: number; rpe: number | null }>;
}
interface ExerciseDraft {
  key: number;
  name: string;
  target_sets: number;
  target_reps_min: number;
  target_reps_max: number;
  video_url: string;
}

function clientOf(assignment: TrainerClientAssignment) {
  return Array.isArray(assignment.client) ? assignment.client[0] ?? null : assignment.client;
}

export default function TrainerProgramsPage() {
  const { user, loading: sessionLoading } = useUserSession();
  const [gymChoices, setGymChoices] = useState<GymChoice[]>([]);
  const [assignments, setAssignments] = useState<TrainerClientAssignment[]>([]);
  const [programs, setPrograms] = useState<TrainerProgram[]>([]);
  const [sessions, setSessions] = useState<WorkoutLog[]>([]);
  const [gymId, setGymId] = useState('');
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nutritionGuidance, setNutritionGuidance] = useState('');
  const [exercises, setExercises] = useState<ExerciseDraft[]>([
    { key: 0, name: '', target_sets: 3, target_reps_min: 8, target_reps_max: 12, video_url: '' },
  ]);
  const [nextExerciseKey, setNextExerciseKey] = useState(1);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadPrograms = useCallback(async () => {
    setDataLoading(true);
    setError('');
    try {
      const response = await fetch('/api/trainer/programs');
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.assignments) || !Array.isArray(result.programs)) {
        throw new Error(result.error || 'Could not load trainer programs.');
      }
      const clientAssignments = result.assignments as TrainerClientAssignment[];
      setAssignments(clientAssignments);
      setPrograms(result.programs as TrainerProgram[]);
      setSessions(Array.isArray(result.sessions) ? result.sessions as WorkoutLog[] : []);
      const gyms = Array.isArray(result.gyms) ? result.gyms as GymChoice[] : [];
      setGymChoices(gyms);
      setGymId((current) => current || gyms[0]?.id || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load trainer programs.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load trainer-owned programs after the signed session has been verified.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!sessionLoading && user?.role === 'trainer') void loadPrograms();
  }, [sessionLoading, user, loadPrograms]);

  const gymAssignments = useMemo(
    () => [...new Map(assignments
      .filter((assignment) => assignment.gym_id === gymId && clientOf(assignment))
      .map((assignment) => [assignment.client_id, assignment])).values()],
    [assignments, gymId],
  );
  const clientNames = useMemo(() => new Map(assignments.map((assignment) => [
    assignment.client_id,
    clientOf(assignment)?.full_name ?? 'Assigned member',
  ])), [assignments]);

  function updateExercise(key: number, field: keyof Omit<ExerciseDraft, 'key'>, value: string) {
    setExercises((current) => current.map((exercise) => {
      if (exercise.key !== key) return exercise;
      if (field === 'name' || field === 'video_url') return { ...exercise, [field]: value };
      return { ...exercise, [field]: value === '' ? 0 : Number(value) };
    }));
  }

  async function createProgram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/trainer/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gym_id: gymId,
          name,
          description,
          nutrition_guidance: nutritionGuidance,
          client_ids: clientIds,
          exercises: exercises.map(({ name: exerciseName, target_sets, target_reps_min, target_reps_max, video_url }) => ({
            name: exerciseName,
            target_sets,
            target_reps_min,
            target_reps_max,
            video_url: video_url.trim() || null,
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create this program.');
      setName('');
      setDescription('');
      setNutritionGuidance('');
      setClientIds([]);
      setExercises([{ key: nextExerciseKey, name: '', target_sets: 3, target_reps_min: 8, target_reps_max: 12, video_url: '' }]);
      setNextExerciseKey((current) => current + 1);
      setNotice(clientIds.length ? 'Program created and assigned to the selected clients.' : 'Program created. Assign a client when you create the next program.');
      await loadPrograms();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not create this program.');
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || dataLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F3EFE5] text-[#0B3D2E]">Loading coaching programs…</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#F3EFE5]">
      <Navigation userFullName={user?.full_name} userRole={user?.role} />
      <main className="mx-auto min-w-0 max-w-6xl flex-1 space-y-7 p-5 pb-24 md:p-10 md:pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0B3D2E]">Coach workspace</p>
            <h1 className="mt-1 font-serif text-4xl text-[#14201A]">Training programs</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#5A6660]">Build a training plan, assign it to active clients, and review their completed workout logs.</p>
          </div>
          <Link href="/trainer" className="rounded-xl border border-[#14201A]/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#0B3D2E]">Coach dashboard</Link>
        </header>

        {error && <p role="alert" className="rounded-xl bg-[#FBE9E1] px-4 py-3 text-sm text-[#8E341E]">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-[#F2F7D9] px-4 py-3 text-sm text-[#0B3D2E]">{notice}</p>}

        <section className="rounded-3xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm md:p-7">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0B3D2E]">Program builder</p>
            <h2 className="mt-1 font-serif text-2xl">Create a client plan</h2>
          </div>
          {!gymChoices.length ? (
            <p className="rounded-2xl bg-[#F3EFE5] p-4 text-sm text-[#5A6660]">No active clients are assigned to your trainer account yet. Ask gym management to connect your trainer and member assignments.</p>
          ) : (
            <form onSubmit={createProgram} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-[#14201A]">Gym
                  <select required value={gymId} onChange={(event) => { setGymId(event.target.value); setClientIds([]); }} className="mt-1.5 block w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal">
                    {gymChoices.map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-[#14201A]">Program name
                  <input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Strength foundation" className="mt-1.5 block w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-[#14201A]">Program notes
                  <textarea maxLength={2000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Goals, schedule, and coaching focus" className="mt-1.5 block w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" />
                </label>
                <label className="text-sm font-semibold text-[#14201A]">Nutrition guidance
                  <textarea maxLength={4000} rows={3} value={nutritionGuidance} onChange={(event) => setNutritionGuidance(event.target.value)} placeholder="General meal or hydration guidance (not medical advice)" className="mt-1.5 block w-full rounded-xl border border-[#14201A]/15 bg-white px-3 py-2.5 font-normal" />
                </label>
              </div>
              <fieldset className="rounded-2xl border border-[#14201A]/10 p-4">
                <legend className="px-1 text-sm font-semibold text-[#14201A]">Assign to active clients</legend>
                {gymAssignments.length ? (
                  <div className="flex flex-wrap gap-2">
                    {gymAssignments.map((assignment) => {
                      const client = clientOf(assignment);
                      if (!client) return null;
                      const checked = clientIds.includes(assignment.client_id);
                      return (
                        <label key={assignment.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${checked ? 'border-[#0B3D2E] bg-[#F2F7D9]' : 'border-[#14201A]/10 bg-white'}`}>
                          <input type="checkbox" checked={checked} onChange={() => setClientIds((current) => checked ? current.filter((id) => id !== assignment.client_id) : [...current, assignment.client_id])} />
                          {client.full_name}
                        </label>
                      );
                    })}
                  </div>
                ) : <p className="text-sm text-[#5A6660]">No clients assigned at this gym.</p>}
              </fieldset>
              <fieldset className="space-y-3 rounded-2xl border border-[#14201A]/10 p-4">
                <legend className="px-1 text-sm font-semibold text-[#14201A]">Exercise prescriptions</legend>
                {exercises.map((exercise, index) => (
                  <div key={exercise.key} className="grid gap-2 rounded-xl bg-[#F3EFE5]/70 p-3 sm:grid-cols-2 lg:grid-cols-6">
                    <label className="text-xs font-semibold text-[#5A6660] sm:col-span-2 lg:col-span-2">Exercise
                      <input required maxLength={120} value={exercise.name} onChange={(event) => updateExercise(exercise.key, 'name', event.target.value)} placeholder={`Exercise ${index + 1}`} className="mt-1 block w-full rounded-lg border border-[#14201A]/15 bg-white px-2.5 py-2 text-sm font-normal text-[#14201A]" />
                    </label>
                    <label className="text-xs font-semibold text-[#5A6660]">Sets
                      <input required type="number" min={1} max={20} value={exercise.target_sets} onChange={(event) => updateExercise(exercise.key, 'target_sets', event.target.value)} className="mt-1 block w-full rounded-lg border border-[#14201A]/15 bg-white px-2.5 py-2 text-sm text-[#14201A]" />
                    </label>
                    <label className="text-xs font-semibold text-[#5A6660]">Reps min
                      <input required type="number" min={1} max={100} value={exercise.target_reps_min} onChange={(event) => updateExercise(exercise.key, 'target_reps_min', event.target.value)} className="mt-1 block w-full rounded-lg border border-[#14201A]/15 bg-white px-2.5 py-2 text-sm text-[#14201A]" />
                    </label>
                    <label className="text-xs font-semibold text-[#5A6660]">Reps max
                      <input required type="number" min={1} max={100} value={exercise.target_reps_max} onChange={(event) => updateExercise(exercise.key, 'target_reps_max', event.target.value)} className="mt-1 block w-full rounded-lg border border-[#14201A]/15 bg-white px-2.5 py-2 text-sm text-[#14201A]" />
                    </label>
                    <label className="text-xs font-semibold text-[#5A6660] sm:col-span-2 lg:col-span-6">Demo video URL (optional)
                      <input type="url" value={exercise.video_url} onChange={(event) => updateExercise(exercise.key, 'video_url', event.target.value)} placeholder="https://…" className="mt-1 block w-full rounded-lg border border-[#14201A]/15 bg-white px-2.5 py-2 text-sm font-normal text-[#14201A]" />
                    </label>
                    {exercises.length > 1 && <button type="button" onClick={() => setExercises((current) => current.filter((entry) => entry.key !== exercise.key))} className="justify-self-start text-xs font-semibold text-[#C1502E] sm:col-span-2 lg:col-span-6">Remove exercise</button>}
                  </div>
                ))}
                <button type="button" onClick={() => { setExercises((current) => [...current, { key: nextExerciseKey, name: '', target_sets: 3, target_reps_min: 8, target_reps_max: 12, video_url: '' }]); setNextExerciseKey((current) => current + 1); }} className="rounded-xl border border-[#0B3D2E]/25 px-3 py-2 text-sm font-semibold text-[#0B3D2E]">+ Add exercise</button>
              </fieldset>
              <button disabled={saving || !gymId} className="rounded-xl bg-[#0B3D2E] px-5 py-3 text-sm font-semibold text-[#F2F7D9] disabled:opacity-60">{saving ? 'Saving program…' : 'Create training program'}</button>
            </form>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-2xl text-[#14201A]">Your programs</h2>
          {!programs.length ? <p className="rounded-2xl bg-[#FCFAF6] p-5 text-sm text-[#5A6660]">Programs you create will appear here.</p> :
            programs.map((program) => (
              <article key={program.id} className="rounded-3xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-2xl text-[#14201A]">{program.name}</h3>
                    <p className="mt-1 text-sm text-[#5A6660]">{gymChoices.find((gym) => gym.id === program.gym_id)?.name ?? 'Gym'} · {program.assignments.filter((assignment) => assignment.status === 'active').length} active clients</p>
                  </div>
                  <span className="rounded-full bg-[#F2F7D9] px-3 py-1 text-xs font-semibold capitalize text-[#0B3D2E]">{program.status}</span>
                </div>
                {program.description && <p className="mt-3 text-sm text-[#5A6660]">{program.description}</p>}
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {program.exercises.map((exercise) => <div key={exercise.id} className="rounded-xl bg-[#F3EFE5]/70 p-3 text-sm"><p className="font-semibold">{exercise.name}</p><p className="mt-1 text-xs text-[#5A6660]">{exercise.target_sets} sets · {exercise.target_reps_min}–{exercise.target_reps_max} reps</p>{exercise.video_url && <a href={exercise.video_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-[#0B3D2E] underline">Exercise demo</a>}</div>)}
                </div>
                {!!program.assignments.length && <p className="mt-4 text-xs text-[#5A6660]">Assigned to: {program.assignments.map((assignment) => clientNames.get(assignment.client_id) ?? 'Member').join(', ')}</p>}
                {program.nutrition_guidance && <p className="mt-3 rounded-xl bg-[#F2F7D9]/70 p-3 text-sm text-[#14201A]"><span className="font-semibold">Nutrition guidance: </span>{program.nutrition_guidance}</p>}
              </article>
            ))}
        </section>

        <section className="rounded-3xl border border-[#14201A]/10 bg-[#FCFAF6] p-5 shadow-sm md:p-6">
          <h2 className="font-serif text-2xl text-[#14201A]">Recent client workouts</h2>
          {!sessions.length ? <p className="mt-3 text-sm text-[#5A6660]">Workout logs from your clients will appear here.</p> :
            <div className="mt-4 space-y-3">
              {sessions.map((session) => <article key={session.id} className="rounded-2xl bg-[#F3EFE5]/70 p-4">
                <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{clientNames.get(session.user_id) ?? 'Client'} · {session.name}</p><time className="text-xs text-[#5A6660]">{session.session_date}</time></div>
                {session.notes && <p className="mt-1 text-sm text-[#5A6660]">{session.notes}</p>}
                <div className="mt-2 flex flex-wrap gap-2">{session.exercise_sets.map((set, index) => <span key={`${session.id}-${index}`} className="rounded-lg bg-white px-2 py-1 text-xs">{set.exercise_name}: {set.weight_kg} kg × {set.reps} (set {set.set_number})</span>)}</div>
              </article>)}
            </div>}
        </section>
      </main>
    </div>
  );
}
