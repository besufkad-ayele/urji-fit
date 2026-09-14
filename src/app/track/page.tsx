'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';
import { supabase } from '@/lib/supabase';
import { BodyMetric } from '@/types';
import { LineChart, Plus, Trash2, CheckCircle, Calendar, AlertCircle } from 'lucide-react';

export default function TrackPage() {
  const { user } = useUserSession();
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [isMonthly, setIsMonthly] = useState(false);
  const [monthlyNeeded, setMonthlyNeeded] = useState(false);
  const [dateInput, setDateInput] = useState(new Date().toISOString().split('T')[0]);

  const fetchMetrics = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('body_metrics')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: true });

    if (data) {
      setMetrics(data as BodyMetric[]);

      // Check if monthly check-in is due
      const currentMonth = new Date().toISOString().slice(0, 7);
      const hasThisMonth = data.some(
        (m: BodyMetric) => m.entry_date.startsWith(currentMonth) && m.is_monthly_checkin
      );
      setMonthlyNeeded(!hasThisMonth);
      if (!hasThisMonth) setIsMonthly(true);
    }
  }, [user]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleAddMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !weight) return;

    try {
      await supabase.from('body_metrics').insert({
        user_id: user.id,
        entry_date: dateInput,
        weight_kg: parseFloat(weight),
        waist_cm: waist ? parseFloat(waist) : null,
        is_monthly_checkin: isMonthly,
      });

      setWeight('');
      setWaist('');
      fetchMetrics();
    } catch {
      alert('Error saving body metric');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this body metric entry?')) return;
    await supabase.from('body_metrics').delete().eq('id', id);
    fetchMetrics();
  };

  // SVG Chart points calculation
  const sorted = [...metrics].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const recent = sorted.slice(-15);
  const weights = recent.map((m) => m.weight_kg);
  const minW = weights.length > 0 ? Math.min(...weights) - 0.5 : 70;
  const maxW = weights.length > 0 ? Math.max(...weights) + 0.5 : 85;
  const range = maxW - minW || 1;

  const chartWidth = 700;
  const chartHeight = 180;
  const pad = 40;

  const points = recent.map((m, i) => {
    const x = pad + (i / Math.max(1, recent.length - 1)) * (chartWidth - pad * 2);
    const y = chartHeight - pad - ((m.weight_kg - minW) / range) * (chartHeight - pad * 2);
    return { x, y, metric: m };
  });

  const pathD =
    points.length > 1
      ? points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')
      : '';

  const latestWeight = recent.length > 0 ? recent[recent.length - 1].weight_kg : null;
  const priorWeight = recent.length > 1 ? recent[0].weight_kg : null;
  const diff = latestWeight && priorWeight ? (latestWeight - priorWeight).toFixed(1) : null;

  return (
    <div className="flex min-h-screen bg-[#F3EFE5]">
      <Navigation userFullName={user?.full_name} userRole={user?.role} />

      <main className="flex-1 p-5 md:p-10 pb-24 md:pb-10 max-w-4xl mx-auto space-y-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-[#0B3D2E] mb-1">
            Body Composition
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-[#0B3D2E] font-medium tracking-tight">
            Track Progress
          </h1>
          <p className="text-sm text-[rgb(90,102,96)] mt-0.5">
            Weigh in under consistent conditions. Track the weekly moving average rather than daily water fluctuations.
          </p>
        </div>

        {/* Mandatory Monthly Check-in Alert */}
        {monthlyNeeded && (
          <div className="p-4 bg-[#F2F7D9] border border-[#0B3D2E]/20 rounded-2xl flex items-start gap-3 text-xs text-[#0B3D2E]">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#0B3D2E]" />
            <div>
              <p className="font-semibold uppercase tracking-wider">
                Monthly Mandatory Check-In Required
              </p>
              <p className="text-[rgb(90,102,96)] mt-0.5">
                Urji Fit requires at least one confirmed body metric entry per calendar month to ensure adaptive workout progression and nutritional guidelines stay accurate.
              </p>
            </div>
          </div>
        )}

        {/* Entry Form */}
        <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="font-serif text-2xl text-[#14201A]">Log Body Metrics</h2>
          <form onSubmit={handleAddMetric} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="e.g. 81.8"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                  Waist Circumference (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 87.5"
                  value={waist}
                  onChange={(e) => setWaist(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#14201A]">
                <input
                  type="checkbox"
                  checked={isMonthly}
                  onChange={(e) => setIsMonthly(e.target.checked)}
                  className="rounded border-[#14201A]/20 text-[#0B3D2E] focus:ring-[#0B3D2E]"
                />
                <span className="font-medium">
                  Record as official Monthly Check-in (satisfies requirement)
                </span>
              </label>

              <button
                type="submit"
                className="px-6 py-2.5 bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9] rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5 self-end sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" /> Record Entry
              </button>
            </div>
          </form>
        </div>

        {/* Trend Chart */}
        <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-2xl text-[#14201A]">Weight Moving Trend</h2>
              <p className="text-xs text-[rgb(90,102,96)]">Visual trajectory over recent entries</p>
            </div>
            {diff !== null && (
              <span className="text-xs font-mono font-bold text-[#0B3D2E] bg-[#F2F7D9] px-2.5 py-1 rounded-full">
                {Number(diff) > 0 ? `+${diff}` : diff} kg change
              </span>
            )}
          </div>

          {points.length < 2 ? (
            <p className="text-xs text-[rgb(90,102,96)] italic py-8 text-center">
              Log at least 2 entries to visualize your trajectory curve.
            </p>
          ) : (
            <div className="w-full overflow-x-auto">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-44">
                <line
                  x1={pad}
                  y1={chartHeight - pad}
                  x2={chartWidth - pad}
                  y2={chartHeight - pad}
                  stroke="rgba(20, 32, 26, 0.1)"
                  strokeWidth="1"
                />
                <path d={pathD} fill="none" stroke="#C1502E" strokeWidth="2.5" />
                {points.map((p, idx) => (
                  <g key={idx}>
                    <circle cx={p.x} cy={p.y} r="4" fill="#0B3D2E" />
                    <text
                      x={p.x}
                      y={p.y - 8}
                      textAnchor="middle"
                      className="text-[10px] font-mono fill-[#14201A]"
                    >
                      {p.metric.weight_kg}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          )}
        </div>

        {/* History Table */}
        <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-5 border-b border-[#14201A]/10">
            <h2 className="font-serif text-2xl text-[#14201A]">Entry History ({metrics.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F3EFE5]/50 border-b border-[#14201A]/10 uppercase font-semibold text-[rgb(90,102,96)] tracking-wider">
                  <th className="p-4">Date</th>
                  <th className="p-4">Weight</th>
                  <th className="p-4">Waist</th>
                  <th className="p-4">Monthly Check-in</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#14201A]/5">
                {[...metrics].reverse().map((m) => (
                  <tr key={m.id} className="hover:bg-white/60">
                    <td className="p-4 font-mono font-medium">{m.entry_date}</td>
                    <td className="p-4 font-mono font-bold text-[#0B3D2E]">{m.weight_kg} kg</td>
                    <td className="p-4 font-mono">{m.waist_cm ? `${m.waist_cm} cm` : '—'}</td>
                    <td className="p-4">
                      {m.is_monthly_checkin ? (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Confirmed
                        </span>
                      ) : (
                        <span className="text-[10px] text-[rgb(90,102,96)]">Standard Entry</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
