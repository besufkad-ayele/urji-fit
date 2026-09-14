'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';
import { supabase } from '@/lib/supabase';
import { WaterLog } from '@/types';
import { Droplets, Plus, Trash2, CheckCircle2 } from 'lucide-react';

const QUICK_VOLUMES = [
  { label: '+250 ml', amount: 250, desc: 'Small glass' },
  { label: '+500 ml', amount: 500, desc: 'Water bottle' },
  { label: '+750 ml', amount: 750, desc: 'Large shaker' },
  { label: '+1000 ml', amount: 1000, desc: '1 Liter carafe' },
];

export default function WaterPage() {
  const { user } = useUserSession();
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const todayStr = new Date().toISOString().split('T')[0];

  const fetchWater = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('water_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', todayStr)
      .order('logged_at', { ascending: false });

    if (data) setLogs(data as WaterLog[]);
  }, [user, todayStr]);

  useEffect(() => {
    fetchWater();
  }, [fetchWater]);

  const handleAddWater = async (amount: number) => {
    if (!user) return;
    try {
      await supabase.from('water_logs').insert({
        user_id: user.id,
        log_date: todayStr,
        amount_ml: amount,
      });
      fetchWater();
    } catch {
      alert('Error adding water log');
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('water_logs').delete().eq('id', id);
    fetchWater();
  };

  const totalMl = logs.reduce((s, l) => s + (l.amount_ml || 0), 0);
  const targetMl = user?.daily_water_target_ml || 2500;
  const percent = Math.min(100, Math.round((totalMl / targetMl) * 100));

  return (
    <div className="flex min-h-screen bg-[#F3EFE5]">
      <Navigation userFullName={user?.full_name} userRole={user?.role} />

      <main className="flex-1 p-5 md:p-10 pb-24 md:pb-10 max-w-4xl mx-auto space-y-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-[#0B3D2E] mb-1">
            Fluid Intake
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-[#0B3D2E] font-medium tracking-tight">
            Hydration Tracker
          </h1>
          <p className="text-sm text-[rgb(90,102,96)] mt-0.5">
            Target hydration helps performance, digestion during eating windows, and muscle recovery.
          </p>
        </div>

        {/* Progress Gauge Card */}
        <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-3xl p-8 shadow-xs text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 shadow-xs">
            <Droplets className="w-10 h-10" />
          </div>

          <div>
            <div className="font-serif text-4xl text-[#14201A] font-medium">
              {totalMl} <span className="text-lg font-sans text-[rgb(90,102,96)]">/ {targetMl} ml</span>
            </div>
            <p className="text-xs text-[rgb(90,102,96)] mt-1">
              {percent >= 100 ? 'Daily hydration goal reached! 🏆' : `${targetMl - totalMl} ml remaining today`}
            </p>
          </div>

          <div className="w-full max-w-md bg-[#14201A]/10 rounded-full h-3 overflow-hidden">
            <div
              className="bg-sky-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Quick Add Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg pt-4 border-t border-[#14201A]/10">
            {QUICK_VOLUMES.map((q) => (
              <button
                key={q.amount}
                onClick={() => handleAddWater(q.amount)}
                className="p-3 bg-white hover:bg-[#F2F7D9]/60 border border-[#14201A]/10 rounded-xl text-center transition-all shadow-xs"
              >
                <div className="text-sm font-semibold text-[#0B3D2E]">{q.label}</div>
                <div className="text-[10px] text-[rgb(90,102,96)] mt-0.5">{q.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Log History */}
        <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="font-serif text-2xl text-[#14201A]">Today's Logs ({logs.length})</h2>
          {logs.length === 0 ? (
            <p className="text-xs text-[rgb(90,102,96)] italic">No water entries logged yet today.</p>
          ) : (
            <div className="divide-y divide-[#14201A]/5">
              {logs.map((l) => {
                const time = new Date(l.logged_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div key={l.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-sky-600" />
                      <span className="font-semibold text-[#14201A]">+{l.amount_ml} ml</span>
                      <span className="text-[11px] text-[rgb(90,102,96)] font-mono">({time})</span>
                    </div>
                    <button
                      onClick={() => handleDelete(l.id)}
                      className="p-1 text-[rgb(90,102,96)] hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
