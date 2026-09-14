'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';
import { supabase } from '@/lib/supabase';
import { SleepLog } from '@/types';
import { Moon, Bell, Plus, Star, Clock, AlertCircle } from 'lucide-react';

export default function SleepPage() {
  const { user } = useUserSession();
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [bedtimeInput, setBedtimeInput] = useState('23:00');
  const [waketimeInput, setWaketimeInput] = useState('07:00');
  const [quality, setQuality] = useState(4);
  const [showModal, setShowModal] = useState(false);

  const fetchSleep = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('sleep_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false })
      .limit(7);

    if (data) setLogs(data as SleepLog[]);
  }, [user]);

  useEffect(() => {
    fetchSleep();
  }, [fetchSleep]);

  const handleLogSleep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Construct bedtime and wake time ISOs
      const bed = new Date(`${todayStr}T${bedtimeInput}:00`);
      // If waketime is earlier than bedtime, wake is next day
      let wake = new Date(`${todayStr}T${waketimeInput}:00`);
      if (wake <= bed) {
        wake = new Date(wake.getTime() + 24 * 60 * 60 * 1000);
      }

      const durationMinutes = Math.round((wake.getTime() - bed.getTime()) / (1000 * 60));

      await supabase.from('sleep_logs').insert({
        user_id: user.id,
        log_date: todayStr,
        bedtime: bed.toISOString(),
        wake_time: wake.toISOString(),
        duration_minutes: durationMinutes,
        quality_rating: quality,
      });

      setShowModal(false);
      fetchSleep();
    } catch {
      alert('Error saving sleep log');
    }
  };

  const latestLog = logs[0];
  const avgDurationMinutes = logs.length > 0
    ? Math.round(logs.reduce((s, l) => s + l.duration_minutes, 0) / logs.length)
    : 450;
  const avgHours = (avgDurationMinutes / 60).toFixed(1);

  // Sleep debt relative to 8h target
  const sleepDebtHours = Math.max(0, (8 - avgDurationMinutes / 60)).toFixed(1);

  return (
    <div className="flex min-h-screen bg-[#F3EFE5]">
      <Navigation userFullName={user?.full_name} userRole={user?.role} />

      <main className="flex-1 p-5 md:p-10 pb-24 md:pb-10 max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-[#0B3D2E] mb-1">
              Recovery & Circadian
            </div>
            <h1 className="font-serif text-3xl md:text-4xl text-[#0B3D2E] font-medium tracking-tight">
              Sleep & Wind-Down
            </h1>
            <p className="text-sm text-[rgb(90,102,96)] mt-0.5">
              Consistent wake times and screen-free wind-down habits accelerate physical recovery.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9] rounded-xl text-xs font-semibold shadow-sm transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Log Night's Sleep
          </button>
        </div>

        {/* Generic Wind-Down Discipline Reminder Banner */}
        <div className="p-5 bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-[#0B3D2E]">
            <Bell className="w-4 h-4 text-[#C1502E]" /> Scheduled Wind-Down Protocol
          </div>
          <div className="p-4 bg-[#F2F7D9]/60 border border-[#0B3D2E]/15 rounded-xl flex items-start gap-3">
            <Moon className="w-5 h-5 text-[#0B3D2E] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#14201A]">
                "Wind-down time — put the phone down for better sleep."
              </p>
              <p className="text-xs text-[rgb(90,102,96)] mt-0.5">
                Triggered automatically <strong>60 minutes</strong> before your target bedtime ({user?.target_bedtime || '23:00'}).
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-5 shadow-xs">
            <span className="text-xs uppercase font-semibold text-[rgb(90,102,96)] tracking-wider">
              Last Night's Sleep
            </span>
            <div className="font-serif text-3xl text-[#14201A] mt-2">
              {latestLog
                ? `${Math.floor(latestLog.duration_minutes / 60)}h ${latestLog.duration_minutes % 60}m`
                : '—'}
            </div>
            <span className="text-xs text-[rgb(90,102,96)] mt-1 block">
              Quality: {latestLog?.quality_rating ? `${latestLog.quality_rating} / 5 ★` : '—'}
            </span>
          </div>

          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-5 shadow-xs">
            <span className="text-xs uppercase font-semibold text-[rgb(90,102,96)] tracking-wider">
              7-Day Average
            </span>
            <div className="font-serif text-3xl text-[#0B3D2E] mt-2">{avgHours}h</div>
            <span className="text-xs text-[rgb(90,102,96)] mt-1 block">Consistent sleep window</span>
          </div>

          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-5 shadow-xs">
            <span className="text-xs uppercase font-semibold text-[rgb(90,102,96)] tracking-wider">
              Estimated Sleep Debt
            </span>
            <div className="font-serif text-3xl text-[#C1502E] mt-2">{sleepDebtHours}h</div>
            <span className="text-xs text-[rgb(90,102,96)] mt-1 block">Relative to 8.0h baseline</span>
          </div>
        </div>

        {/* Recent Sleep Logs */}
        <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="font-serif text-2xl text-[#14201A]">Sleep History</h2>
          {logs.length === 0 ? (
            <p className="text-xs text-[rgb(90,102,96)] italic">No sleep sessions recorded yet.</p>
          ) : (
            <div className="divide-y divide-[#14201A]/5">
              {logs.map((l) => {
                const h = Math.floor(l.duration_minutes / 60);
                const m = l.duration_minutes % 60;
                return (
                  <div key={l.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-[#14201A]">{l.log_date}</span>
                      <div className="text-[11px] text-[rgb(90,102,96)]">
                        {new Date(l.bedtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} →{' '}
                        {new Date(l.wake_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-[#0B3D2E]">
                        {h}h {m}m
                      </div>
                      <div className="text-[11px] text-[rgb(90,102,96)]">Rating: {l.quality_rating || 4}/5 ★</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Log Sleep Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl">
            <h2 className="font-serif text-2xl text-[#0B3D2E] font-medium mb-1">Log Sleep</h2>
            <p className="text-xs text-[rgb(90,102,96)] mb-4">Record your bedtime and wake time.</p>

            <form onSubmit={handleLogSleep} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                    Bedtime
                  </label>
                  <input
                    type="time"
                    required
                    value={bedtimeInput}
                    onChange={(e) => setBedtimeInput(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                    Wake Time
                  </label>
                  <input
                    type="time"
                    required
                    value={waketimeInput}
                    onChange={(e) => setWaketimeInput(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                  Quality Rating (1–5)
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuality(num)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                        quality === num
                          ? 'bg-[#0B3D2E] text-[#F2F7D9]'
                          : 'bg-black/5 text-[rgb(90,102,96)] hover:bg-black/10'
                      }`}
                    >
                      {num} ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-[#14201A]/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-black/5 rounded-xl text-xs font-semibold text-[rgb(90,102,96)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#0B3D2E] text-[#F2F7D9] rounded-xl text-xs font-semibold shadow-sm"
                >
                  Save Sleep Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
