'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';
import { supabase } from '@/lib/supabase';
import { WorkoutTemplate, WorkoutExercise } from '@/types';
import { Plus, Trash2, Edit2, Check, Calendar, Video, Music } from 'lucide-react';

const WEEKDAYS = [
  { id: 1, name: 'Mon' },
  { id: 2, name: 'Tue' },
  { id: 3, name: 'Wed' },
  { id: 4, name: 'Thu' },
  { id: 5, name: 'Fri' },
  { id: 6, name: 'Sat' },
  { id: 0, name: 'Sun' },
];

export default function BuildPage() {
  const { user } = useUserSession();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempTag, setTempTag] = useState('Custom');
  const [tempDays, setTempDays] = useState<number[]>([]);
  const [tempCardio, setTempCardio] = useState('');
  const [tempExercises, setTempExercises] = useState<
    Array<{ name: string; spec: string; video_url: string; music_url: string }>
  >([]);

  const fetchTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('workout_templates')
      .select('*, workout_exercises(*)')
      .order('name');

    if (data) {
      setTemplates(
        data.map((t) => ({
          ...t,
          workout_exercises: (t.workout_exercises || []).sort(
            (a: WorkoutExercise, b: WorkoutExercise) => a.order_index - b.order_index
          ),
        }))
      );
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openEditor = (tmpl?: WorkoutTemplate) => {
    if (tmpl) {
      setEditingTemplate(tmpl);
      setTempName(tmpl.name);
      setTempTag(tmpl.tag);
      setTempDays(tmpl.days || []);
      setTempCardio(tmpl.cardio || '');
      setTempExercises(
        tmpl.workout_exercises?.map((e) => ({
          name: e.name,
          spec: e.spec,
          video_url: e.video_url || '',
          music_url: e.music_url || '',
        })) || []
      );
    } else {
      setEditingTemplate(null);
      setTempName('');
      setTempTag('Push');
      setTempDays([]);
      setTempCardio('');
      setTempExercises([{ name: '', spec: '3×8–12', video_url: '', music_url: '' }]);
    }
    setShowModal(true);
  };

  const handleToggleDay = (d: number) => {
    setTempDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const handleAddExerciseRow = () => {
    setTempExercises((prev) => [...prev, { name: '', spec: '3×8–12', video_url: '', music_url: '' }]);
  };

  const handleRemoveExerciseRow = (index: number) => {
    setTempExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim()) return;

    try {
      let tmplId = editingTemplate?.id;

      if (tmplId) {
        // Update template
        await supabase
          .from('workout_templates')
          .update({
            name: tempName.trim(),
            tag: tempTag.trim(),
            days: tempDays,
            cardio: tempCardio.trim() || null,
          })
          .eq('id', tmplId);

        // Remove old exercises and re-insert
        await supabase.from('workout_exercises').delete().eq('workout_template_id', tmplId);
      } else {
        // Insert new
        const { data: created } = await supabase
          .from('workout_templates')
          .insert({
            user_id: user?.id,
            name: tempName.trim(),
            tag: tempTag.trim(),
            days: tempDays,
            cardio: tempCardio.trim() || null,
          })
          .select('id')
          .single();

        tmplId = created?.id;
      }

      if (tmplId && tempExercises.length > 0) {
        const rows = tempExercises
          .filter((ex) => ex.name.trim())
          .map((ex, idx) => ({
            workout_template_id: tmplId!,
            name: ex.name.trim(),
            spec: ex.spec.trim() || '3×8–12',
            video_url: ex.video_url.trim() || null,
            music_url: ex.music_url.trim() || null,
            order_index: idx,
          }));

        if (rows.length > 0) {
          await supabase.from('workout_exercises').insert(rows);
        }
      }

      setShowModal(false);
      fetchTemplates();
    } catch {
      alert('Error saving workout template');
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F3EFE5]">
      <Navigation userFullName={user?.full_name} userRole={user?.role} />

      <main className="flex-1 p-5 md:p-10 pb-24 md:pb-10 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-[#0B3D2E] mb-1">
              Program Editor
            </div>
            <h1 className="font-serif text-3xl md:text-4xl text-[#0B3D2E] font-medium tracking-tight">
              Build Workouts
            </h1>
            <p className="text-sm text-[rgb(90,102,96)] mt-0.5">
              Create and adjust your weekly resistance splits, exercises, and form references.
            </p>
          </div>

          <button
            onClick={() => openEditor()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9] rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> New Training
          </button>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-5 shadow-xs space-y-4 hover:border-[#0B3D2E]/20 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#C1502E] bg-[#C1502E]/10 px-2 py-0.5 rounded-full">
                    {tmpl.tag}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditor(tmpl)}
                      className="p-1 text-[rgb(90,102,96)] hover:text-[#0B3D2E]"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-serif text-xl text-[#14201A] font-medium">{tmpl.name}</h3>

                {/* Day badges */}
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {WEEKDAYS.map((w) => {
                    const active = (tmpl.days || []).includes(w.id);
                    return (
                      <span
                        key={w.id}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                          active
                            ? 'bg-[#0B3D2E] text-[#F2F7D9]'
                            : 'bg-black/5 text-[rgb(90,102,96)] opacity-40'
                        }`}
                      >
                        {w.name}
                      </span>
                    );
                  })}
                </div>

                <div className="mt-3 text-xs text-[rgb(90,102,96)] font-medium">
                  {tmpl.workout_exercises?.length || 0} exercises prescribed
                  {tmpl.cardio ? ` · ${tmpl.cardio}` : ''}
                </div>
              </div>

              <div className="pt-3 border-t border-[#14201A]/5 text-[11px] text-[rgb(90,102,96)] truncate">
                {tmpl.workout_exercises?.map((e) => e.name).join(' · ')}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Builder Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl my-8">
            <h2 className="font-serif text-2xl text-[#0B3D2E] font-medium mb-1">
              {editingTemplate ? 'Edit Training Split' : 'New Training Split'}
            </h2>
            <p className="text-xs text-[rgb(90,102,96)] mb-5">
              Define the workout details and attach video and music links for each exercise.
            </p>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                  Training Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chest + Triceps"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                    Tag / Category
                  </label>
                  <input
                    type="text"
                    placeholder="Push / Pull / Legs / Full"
                    value={tempTag}
                    onChange={(e) => setTempTag(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                    Cardio Prescription
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Incline walk 15m"
                    value={tempCardio}
                    onChange={(e) => setTempCardio(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Day assignment */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                  Assigned Weekdays
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {WEEKDAYS.map((w) => {
                    const on = tempDays.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => handleToggleDay(w.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all ${
                          on
                            ? 'bg-[#0B3D2E] text-[#F2F7D9]'
                            : 'bg-black/5 text-[rgb(90,102,96)] hover:bg-black/10'
                        }`}
                      >
                        {w.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Exercises List */}
              <div className="pt-3 border-t border-[#14201A]/10">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)]">
                    Exercises
                  </label>
                  <button
                    type="button"
                    onClick={handleAddExerciseRow}
                    className="text-xs font-semibold text-[#0B3D2E] hover:underline"
                  >
                    + Add Exercise
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {tempExercises.map((ex, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white border border-[#14201A]/10 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Exercise name (e.g. Bench Press)"
                          value={ex.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTempExercises((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                            );
                          }}
                          className="flex-1 px-2.5 py-1.5 bg-[#F3EFE5]/50 border border-[#14201A]/10 rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="3×8–12"
                          value={ex.spec}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTempExercises((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, spec: val } : item))
                            );
                          }}
                          className="w-20 px-2.5 py-1.5 bg-[#F3EFE5]/50 border border-[#14201A]/10 rounded-lg text-center"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveExerciseRow(idx)}
                          className="text-red-500 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="url"
                          placeholder="Video URL (YouTube/tutorial)"
                          value={ex.video_url}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTempExercises((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, video_url: val } : item))
                            );
                          }}
                          className="px-2 py-1 bg-[#F3EFE5]/30 border border-[#14201A]/10 rounded-lg text-[11px]"
                        />
                        <input
                          type="url"
                          placeholder="Audio/Music URL (optional)"
                          value={ex.music_url}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTempExercises((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, music_url: val } : item))
                            );
                          }}
                          className="px-2 py-1 bg-[#F3EFE5]/30 border border-[#14201A]/10 rounded-lg text-[11px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#14201A]/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-black/5 hover:bg-black/10 rounded-xl text-xs font-semibold text-[rgb(90,102,96)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9] rounded-xl text-xs font-semibold shadow-sm"
                >
                  Save Training Split
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
