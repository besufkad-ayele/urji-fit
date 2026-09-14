'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';
import { supabase } from '@/lib/supabase';
import { FastingWindow } from '@/types';
import { Play, Square, Timer, Flame, CheckCircle2 } from 'lucide-react';

const PRESETS = [
  { name: '16:8', hours: 16, label: 'Standard Intermittent' },
  { name: '18:6', hours: 18, label: 'Extended Fast' },
  { name: '20:4', hours: 20, label: 'Warrior Fast' },
  { name: 'Custom', hours: 14, label: 'Gentle 14h' },
];

export default function FastingPage() {
  const { user } = useUserSession();
  const [activeFast, setActiveFast] = useState<FastingWindow | null>(null);
  const [history, setHistory] = useState<FastingWindow[]>([]);
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const fetchFasting = useCallback(async () => {
    if (!user) return;
    // Active fast
    const { data: active } = await supabase
      .from('fasting_windows')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setActiveFast(active as FastingWindow | null);

    // Past fasts
    const { data: past } = await supabase
      .from('fasting_windows')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(10);

    if (past) setHistory(past as FastingWindow[]);
  }, [user]);

  useEffect(() => {
    fetchFasting();
  }, [fetchFasting]);

  // Live timer tick
  useEffect(() => {
    if (!activeFast) return;
    const interval = setInterval(() => {
      const start = new Date(activeFast.started_at).getTime();
      const now = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((now - start) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeFast]);

  const handleStartFast = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('fasting_windows')
        .insert({
          user_id: user.id,
          preset: selectedPreset.name,
          target_hours: selectedPreset.hours,
          started_at: new Date().toISOString(),
          status: 'active',
        })
        .select('*')
        .single();

      if (data) {
        setActiveFast(data as FastingWindow);
      }
    } catch {
      alert('Error starting fast');
    }
  };

  const handleEndFast = async () => {
    if (!activeFast) return;
    try {
      await supabase
        .from('fasting_windows')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', activeFast.id);

      setActiveFast(null);
      fetchFasting();
    } catch {
      alert('Error ending fast');
    }
  };

  const targetSeconds = activeFast ? activeFast.target_hours * 3600 : selectedPreset.hours * 3600;
  const progressPct = Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100));

  const formatHoursMins = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="flex min-h-screen bg-[#F3EFE5]">
      <Navigation userFullName={user?.full_name} userRole={user?.role} />

      <main className="flex-1 p-5 md:p-10 pb-24 md:pb-10 max-w-4xl mx-auto space-y-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-[#0B3D2E] mb-1">
            Fasting Window
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-[#0B3D2E] font-medium tracking-tight">
            Intermittent Fasting Timer
          </h1>
          <p className="text-sm text-[rgb(90,102,96)] mt-0.5">
            Integrated with your food log. Logging meals will automatically align with your eating windows.
          </p>
        </div>

        {/* Big Timer Circle Display */}
        <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-3xl p-8 md:p-12 shadow-sm text-center flex flex-col items-center justify-center space-y-6">
          <div className="relative w-64 h-64 flex items-center justify-center">
            {/* SVG Circular Progress */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="rgba(20, 32, 26, 0.08)"
                strokeWidth="6"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="#0B3D2E"
                strokeWidth="6"
                strokeDasharray="276"
                strokeDashoffset={276 - (276 * progressPct) / 100}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs uppercase font-bold tracking-widest text-[#C1502E]">
                {activeFast ? `${activeFast.preset} Fasting` : 'Ready to Fast'}
              </span>
              <div className="font-serif text-3xl md:text-4xl text-[#14201A] font-medium my-1">
                {activeFast ? formatHoursMins(elapsedSeconds) : `${selectedPreset.hours}:00:00`}
              </div>
              <span className="text-xs text-[rgb(90,102,96)] font-mono">
                {activeFast ? `${progressPct}% Complete` : `Goal: ${selectedPreset.hours}h`}
              </span>
            </div>
          </div>

          {/* Action button */}
          {activeFast ? (
            <button
              onClick={handleEndFast}
              className="px-8 py-3.5 bg-[#C1502E] hover:bg-[#a64022] text-white rounded-2xl font-medium text-sm transition-all shadow-md flex items-center gap-2"
            >
              <Square className="w-4 h-4 fill-current" /> End Fast (Open Eating Window)
            </button>
          ) : (
            <button
              onClick={handleStartFast}
              className="px-8 py-3.5 bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9] rounded-2xl font-medium text-sm transition-all shadow-md flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" /> Start {selectedPreset.name} Fast
            </button>
          )}

          {/* Presets selector (if not currently fasting) */}
          {!activeFast && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full max-w-lg pt-4 border-t border-[#14201A]/10">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setSelectedPreset(p)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    selectedPreset.name === p.name
                      ? 'bg-[#0B3D2E] text-[#F2F7D9] border-[#0B3D2E] shadow-sm'
                      : 'bg-white/60 text-[#14201A] border-[#14201A]/10 hover:bg-[#F2F7D9]/50'
                  }`}
                >
                  <div className="font-serif text-lg font-bold">{p.name}</div>
                  <div className="text-[10px] text-[rgb(90,102,96)] mt-0.5">{p.hours}h Goal</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fasting History */}
        <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl text-[#14201A]">Recent Fasting Streaks</h2>
            <div className="flex items-center gap-1 text-xs font-semibold text-[#0B3D2E]">
              <Flame className="w-4 h-4 text-[#C1502E]" /> Adherence Streak Active
            </div>
          </div>

          {history.length === 0 ? (
            <p className="text-xs text-[rgb(90,102,96)] italic">No completed fasts recorded yet.</p>
          ) : (
            <div className="divide-y divide-[#14201A]/5">
              {history.map((h) => {
                const start = new Date(h.started_at);
                const end = h.ended_at ? new Date(h.ended_at) : null;
                const durHours = end
                  ? ((end.getTime() - start.getTime()) / (1000 * 3600)).toFixed(1)
                  : h.target_hours.toString();

                return (
                  <div key={h.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <div>
                        <span className="font-semibold text-[#14201A]">{h.preset} Window</span>
                        <div className="text-[11px] text-[rgb(90,102,96)]">
                          {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-[#0B3D2E]">{durHours}h Fasted</span>
                      <div className="text-[10px] text-[rgb(90,102,96)]">Goal: {h.target_hours}h</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
