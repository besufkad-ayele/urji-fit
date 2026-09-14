'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';
import { supabase } from '@/lib/supabase';
import { WorkoutTemplate, WorkoutExercise } from '@/types';
import {
  Check,
  Video,
  Music,
  Zap,
  TrendingUp,
  Flame,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

const WEEKDAYS = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
  { id: 0, name: 'Sunday' },
];

export default function TrainPage() {
  const { user } = useUserSession();
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<WorkoutTemplate | null>(null);
  const [completedExercises, setCompletedExercises] = useState<Record<string, boolean>>({});
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [reps, setReps] = useState<Record<string, number>>({});
  const [progressionAlert, setProgressionAlert] = useState<{
    exerciseName: string;
    previousWeight: number;
    suggestedWeight: number;
    reason: string;
  } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    const { data, error } = await supabase
      .from('workout_templates')
      .select('*, workout_exercises(*)')
      .order('name');

    if (!error && data) {
      const formatted = data.map((t) => ({
        ...t,
        workout_exercises: (t.workout_exercises || []).sort(
          (a: WorkoutExercise, b: WorkoutExercise) => a.order_index - b.order_index
        ),
      }));
      setTemplates(formatted);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // When templates or selectedDay changes, find the template assigned to this day
  useEffect(() => {
    const found = templates.find((t) => (t.days || []).includes(selectedDay));
    setActiveTemplate(found || null);
    setCompletedExercises({});
  }, [templates, selectedDay]);

  const toggleComplete = async (ex: WorkoutExercise) => {
    if (!user) return;
    const isNowDone = !completedExercises[ex.id];
    setCompletedExercises((prev) => ({ ...prev, [ex.id]: isNowDone }));

    const currentWeight = weights[ex.id] || 40;
    const currentReps = reps[ex.id] || ex.target_reps_max;

    if (isNowDone) {
      // 1. Ensure or create workout session for today
      let curSessId = sessionId;
      if (!curSessId) {
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: sess } = await supabase
          .from('workout_sessions')
          .insert({
            user_id: user.id,
            workout_template_id: activeTemplate?.id,
            name: activeTemplate?.name || 'Workout',
            session_date: todayStr,
          })
          .select('id')
          .single();

        if (sess) {
          curSessId = sess.id;
          setSessionId(sess.id);
        }
      }

      // 2. Log exercise set
      if (curSessId) {
        await supabase.from('exercise_sets').insert({
          session_id: curSessId,
          exercise_name: ex.name,
          set_number: 1,
          weight_kg: currentWeight,
          reps: currentReps,
          is_completed: true,
        });

        // 3. Evaluate Progressive Overload
        try {
          const res = await fetch('/api/progressive-overload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              exerciseName: ex.name,
              targetMaxReps: ex.target_reps_max,
              currentWeight,
            }),
          });
          const data = await res.json();
          if (data.suggestion) {
            setProgressionAlert({
              exerciseName: ex.name,
              previousWeight: data.suggestion.previous_weight_kg,
              suggestedWeight: data.suggestion.suggested_weight_kg,
              reason: data.suggestion.reason,
            });
          }
        } catch {
          // Non-blocking
        }
      }
    }
  };

  const completedCount = Object.values(completedExercises).filter(Boolean).length;
  const totalCount = activeTemplate?.workout_exercises?.length || 0;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="flex min-h-screen bg-[#F3EFE5]">
      <Navigation userFullName={user?.full_name} userRole={user?.role} />

      <main className="flex-1 p-5 md:p-10 pb-24 md:pb-10 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-[#0B3D2E] mb-1">
              Resistance & Cardio
            </div>
            <h1 className="font-serif text-3xl md:text-4xl text-[#0B3D2E] font-medium tracking-tight">
              Workout Tracker
            </h1>
            <p className="text-sm text-[rgb(90,102,96)] mt-0.5">
              Compound movements: rest 2–3 min. Isolation work: rest 60–90 sec.
            </p>
          </div>

          <Link
            href="/build"
            className="text-xs font-semibold px-3 py-2 bg-white border border-[#14201A]/10 rounded-xl hover:bg-[#F2F7D9]/50 transition-colors shadow-xs inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            Customize Split / Build →
          </Link>
        </div>

        {/* Weekday Selector Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {WEEKDAYS.map((w) => {
            const isSelected = selectedDay === w.id;
            return (
              <button
                key={w.id}
                onClick={() => setSelectedDay(w.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wide whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#0B3D2E] text-[#F2F7D9] shadow-sm'
                    : 'bg-[#FCFAF6] text-[rgb(90,102,96)] border border-[#14201A]/10 hover:bg-[#F2F7D9]/50'
                }`}
              >
                {w.name}
              </button>
            );
          })}
        </div>

        {/* Progressive Overload Alert */}
        {progressionAlert && (
          <div className="p-4 bg-[#F2F7D9] border border-[#0B3D2E]/20 rounded-2xl flex items-start gap-3 text-sm text-[#0B3D2E] shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="p-2 bg-[#0B3D2E] text-[#F2F7D9] rounded-xl flex-shrink-0 mt-0.5">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider text-[#C1502E]">
                  Progressive Overload Triggered
                </span>
                <span className="text-[10px] bg-[#C1502E]/15 text-[#C1502E] font-semibold px-2 py-0.5 rounded-full">
                  +{progressionAlert.suggestedWeight - progressionAlert.previousWeight} kg
                </span>
              </div>
              <p className="font-serif text-lg text-[#14201A] mt-0.5">
                Advance <strong>{progressionAlert.exerciseName}</strong>: {progressionAlert.previousWeight}kg →{' '}
                <span className="text-[#0B3D2E] underline font-bold">{progressionAlert.suggestedWeight}kg</span>
              </p>
              <p className="text-xs text-[rgb(90,102,96)] mt-0.5">{progressionAlert.reason}</p>
            </div>
            <button
              onClick={() => setProgressionAlert(null)}
              className="text-xs font-semibold text-[rgb(90,102,96)] hover:text-[#14201A]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Active Day Card */}
        {activeTemplate ? (
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-[#14201A]/10 pb-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#C1502E]">
                  {activeTemplate.tag}
                </span>
                <h2 className="font-serif text-2xl text-[#14201A] font-medium">{activeTemplate.name}</h2>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-[#0B3D2E]">
                  {completedCount} / {totalCount} Completed
                </div>
                <div className="text-[11px] text-[rgb(90,102,96)] font-mono mt-0.5">{progressPct}% Done</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-[#14201A]/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#0B3D2E] h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Exercises List */}
            <div className="space-y-3">
              {activeTemplate.workout_exercises?.map((ex) => {
                const isChecked = !!completedExercises[ex.id];
                const weightVal = weights[ex.id] !== undefined ? weights[ex.id] : 40;
                const repsVal = reps[ex.id] !== undefined ? reps[ex.id] : ex.target_reps_max;

                return (
                  <div
                    key={ex.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isChecked
                        ? 'bg-[#F2F7D9]/40 border-[#3B7A57]/30'
                        : 'bg-white border-[#14201A]/10 hover:border-[#0B3D2E]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleComplete(ex)}
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                            isChecked
                              ? 'bg-[#3B7A57] border-[#3B7A57] text-white'
                              : 'border-[#14201A]/30 bg-transparent hover:border-[#0B3D2E]'
                          }`}
                        >
                          {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                        </button>
                        <div className="truncate">
                          <h3
                            className={`text-sm font-medium transition-all ${
                              isChecked ? 'line-through text-[rgb(90,102,96)]' : 'text-[#14201A]'
                            }`}
                          >
                            {ex.name}
                          </h3>
                          <span className="text-xs font-mono text-[#C1502E]">{ex.spec}</span>
                        </div>
                      </div>

                      {/* Weight and Reps inputs */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1 bg-[#F3EFE5]/80 px-2 py-1 rounded-lg border border-[#14201A]/10 text-xs">
                          <input
                            type="number"
                            step="0.5"
                            value={weightVal}
                            onChange={(e) =>
                              setWeights((prev) => ({
                                ...prev,
                                [ex.id]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-12 bg-transparent text-right font-mono font-medium focus:outline-none text-[#14201A]"
                          />
                          <span className="text-[10px] text-[rgb(90,102,96)] font-semibold">KG</span>
                        </div>

                        <div className="flex items-center gap-1 bg-[#F3EFE5]/80 px-2 py-1 rounded-lg border border-[#14201A]/10 text-xs">
                          <input
                            type="number"
                            value={repsVal}
                            onChange={(e) =>
                              setReps((prev) => ({
                                ...prev,
                                [ex.id]: parseInt(e.target.value) || 0,
                              }))
                            }
                            className="w-8 bg-transparent text-right font-mono font-medium focus:outline-none text-[#14201A]"
                          />
                          <span className="text-[10px] text-[rgb(90,102,96)] font-semibold">REPS</span>
                        </div>
                      </div>
                    </div>

                    {/* Tutorial & Reference Links */}
                    <div className="flex items-center gap-2 mt-2.5 pl-9">
                      {ex.video_url && (
                        <a
                          href={ex.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[rgb(90,102,96)] hover:text-[#0B3D2E] bg-black/5 hover:bg-black/10 px-2.5 py-1 rounded-md transition-colors"
                        >
                          <Video className="w-3 h-3 text-[#C1502E]" /> Form Video
                        </a>
                      )}
                      {ex.music_url && (
                        <a
                          href={ex.music_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[rgb(90,102,96)] hover:text-[#0B3D2E] bg-black/5 hover:bg-black/10 px-2.5 py-1 rounded-md transition-colors"
                        >
                          <Music className="w-3 h-3 text-sky-600" /> Focus Audio
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cardio note if assigned */}
            {activeTemplate.cardio && (
              <div className="p-3.5 bg-[#F2F7D9]/50 border-l-4 border-[#0B3D2E] rounded-r-xl text-xs text-[#14201A] flex items-center justify-between">
                <div>
                  <strong>Prescribed Cardio:</strong> {activeTemplate.cardio}
                </div>
                <Flame className="w-4 h-4 text-[#C1502E]" />
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#F2F7D9] text-[#0B3D2E] flex items-center justify-center mx-auto">
              <Zap className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-2xl text-[#14201A]">Active Recovery Day</h2>
            <p className="text-sm text-[rgb(90,102,96)] max-w-md mx-auto">
              No resistance session scheduled for today. Focus on hydration, stretching, and letting muscle recovery take place.
            </p>
            <Link
              href="/build"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0B3D2E] text-[#F2F7D9] rounded-xl text-xs font-semibold shadow-xs"
            >
              Assign or Create Training for this Day <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
