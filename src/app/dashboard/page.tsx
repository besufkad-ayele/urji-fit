'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import DisclaimerModal from '@/components/DisclaimerModal';
import { useUserSession } from '@/hooks/useUserSession';
import { supabase } from '@/lib/supabase';
import {
  Dumbbell,
  Utensils,
  Timer,
  Droplets,
  Moon,
  AlertCircle,
  Plus,
  Flame,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';
import Link from 'next/link';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, refreshUser } = useUserSession();
  
  // IMMEDIATE early return for non-member roles - don't even set up state
  if (typeof window !== 'undefined') {
    const storedUser = localStorage.getItem('urji_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.role === 'admin' || parsed.role === 'platform_admin') {
          router.replace('/admin');
          return <div className="flex items-center justify-center min-h-screen bg-[#F3EFE5]">
            <p className="font-serif text-2xl text-[#0B3D2E]">Redirecting to Admin Panel...</p>
          </div>;
        }
        if (parsed.role === 'gym_owner') {
          router.replace('/gym-owner');
          return <div className="flex items-center justify-center min-h-screen bg-[#F3EFE5]">
            <p className="font-serif text-2xl text-[#0B3D2E]">Redirecting to Gym Owner Dashboard...</p>
          </div>;
        }
        if (parsed.role === 'trainer') {
          router.replace('/trainer');
          return <div className="flex items-center justify-center min-h-screen bg-[#F3EFE5]">
            <p className="font-serif text-2xl text-[#0B3D2E]">Redirecting to Trainer Dashboard...</p>
          </div>;
        }
      } catch (e) {
        console.error('Error parsing stored user:', e);
      }
    }
  }
  
  const [quickWeight, setQuickWeight] = useState('');
  const [quickWeightSaved, setQuickWeightSaved] = useState(false);
  const [monthlyDue, setMonthlyDue] = useState(false);
  const [todayCalories, setTodayCalories] = useState(0);
  const [todayProtein, setTodayProtein] = useState(0);
  const [todayWater, setTodayWater] = useState(0);
  const [activeFast, setActiveFast] = useState<{ preset: string; started_at: string; target_hours: number } | null>(null);
  const [lastNightSleep, setLastNightSleep] = useState<{ duration_minutes: number; quality_rating: number } | null>(null);
  const [weekCompletedDays, setWeekCompletedDays] = useState<number[]>([]);
  const [streakDays, setStreakDays] = useState(4);

  const today = new Date();
  const todayDateStr = today.toISOString().split('T')[0];
  const currentDayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon ...

  const loadDashboardData = useCallback(async (userId: string) => {
    // 1. Food logs
    const { data: food } = await supabase
      .from('food_logs')
      .select('calories, protein_g')
      .eq('user_id', userId)
      .eq('log_date', todayDateStr);

    if (food) {
      const cals = food.reduce((s, f) => s + (f.calories || 0), 0);
      const prot = food.reduce((s, f) => s + (Number(f.protein_g) || 0), 0);
      setTodayCalories(cals);
      setTodayProtein(Math.round(prot));
    }

    // 2. Water logs
    const { data: water } = await supabase
      .from('water_logs')
      .select('amount_ml')
      .eq('user_id', userId)
      .eq('log_date', todayDateStr);

    if (water) {
      const total = water.reduce((s, w) => s + (w.amount_ml || 0), 0);
      setTodayWater(total);
    }

    // 3. Fasting
    const { data: fast } = await supabase
      .from('fasting_windows')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fast) {
      setActiveFast(fast);
    }

    // 4. Sleep
    const { data: sleep } = await supabase
      .from('sleep_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sleep) {
      setLastNightSleep(sleep);
    }

    // 5. Monthly check-in check
    const startOfMonth = todayDateStr.slice(0, 7) + '-01';
    const { data: monthly } = await supabase
      .from('body_metrics')
      .select('id')
      .eq('user_id', userId)
      .gte('entry_date', startOfMonth)
      .eq('is_monthly_checkin', true)
      .limit(1);

    setMonthlyDue(!monthly || monthly.length === 0);

    // 6. Workout history this week
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('session_date')
      .eq('user_id', userId);

    if (sessions) {
      const completed = sessions.map((s) => new Date(s.session_date).getDay());
      setWeekCompletedDays(completed);
    }
  }, [todayDateStr]);

  // Redirect non-members to their respective dashboards
  useEffect(() => {
    console.log('Dashboard useEffect - loading:', loading, 'user role:', user?.role);
    if (!loading && user) {
      if (user.role === 'admin' || user.role === 'platform_admin') {
        console.log('Redirecting admin to /admin page');
        router.replace('/admin');
        return;
      }
      if (user.role === 'gym_owner') {
        console.log('Redirecting gym owner to /gym-owner page');
        router.replace('/gym-owner');
        return;
      }
      if (user.role === 'trainer') {
        console.log('Redirecting trainer to /trainer page');
        router.replace('/trainer');
        return;
      }
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.id && user?.role === 'member') {
      loadDashboardData(user.id);
    }
  }, [user, loadDashboardData]);

  const handleQuickWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !quickWeight) return;

    try {
      await supabase.from('body_metrics').insert({
        user_id: user.id,
        entry_date: todayDateStr,
        weight_kg: parseFloat(quickWeight),
        is_monthly_checkin: monthlyDue,
      });
      setQuickWeightSaved(true);
      setQuickWeight('');
      setMonthlyDue(false);
      setTimeout(() => setQuickWeightSaved(false), 3000);
    } catch {
      alert('Error saving weight');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F3EFE5]">
        <p className="font-serif text-2xl text-[#0B3D2E]">Loading Today's Planner…</p>
      </div>
    );
  }

  // Don't render dashboard for non-members (they'll be redirected)
  if (user?.role && user.role !== 'member') {
    return null;
  }

  const calorieTarget = user?.daily_calorie_target || 2000;
  const proteinTarget = user?.daily_protein_target || 150;
  const waterTarget = user?.daily_water_target_ml || 2500;
  const calPercent = Math.min(100, Math.round((todayCalories / calorieTarget) * 100));
  const waterPercent = Math.min(100, Math.round((todayWater / waterTarget) * 100));

  return (
    <div className="flex min-h-screen bg-[#F3EFE5]">
      <Navigation userFullName={user?.full_name} userRole={user?.role} />

      {/* Mandatory Onboarding Health Disclaimer Modal */}
      {user && !user.onboarding_completed && (
        <DisclaimerModal
          isOpen={true}
          userId={user.id}
          onAcknowledged={() => {
            refreshUser({
              ...user,
              onboarding_completed: true,
              disclaimer_acknowledged_at: new Date().toISOString(),
            });
          }}
        />
      )}

      <main className="flex-1 p-5 md:p-10 pb-24 md:pb-10 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-[#0B3D2E] mb-1">
              Today's Overview
            </div>
            <h1 className="font-serif text-3xl md:text-4xl text-[#0B3D2E] font-medium tracking-tight">
              {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </h1>
            <p className="text-sm text-[rgb(90,102,96)] mt-0.5">
              Integrated health & progressive training dashboard.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl px-4 py-2.5 flex items-center gap-2.5 shadow-xs">
              <Flame className="w-5 h-5 text-[#C1502E]" />
              <div>
                <div className="text-xs font-semibold text-[#14201A]">{streakDays} Days</div>
                <div className="text-[10px] text-[rgb(90,102,96)] uppercase font-semibold">Streak</div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Check-in Alert Banner */}
        {monthlyDue && (
          <div className="p-4 bg-[#F2F7D9] border border-[#0B3D2E]/20 rounded-2xl flex items-start gap-3 text-sm text-[#0B3D2E]">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#0B3D2E]" />
            <div className="flex-1">
              <p className="font-semibold text-xs uppercase tracking-wider">
                Mandatory Monthly Body Metric Check-in Due
              </p>
              <p className="text-xs text-[rgb(90,102,96)] mt-0.5">
                At least one weight entry per calendar month keeps progressive overload calculations accurate. Log below to clear this alert.
              </p>
            </div>
          </div>
        )}

        {/* The Weekly Rack */}
        <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-5 md:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif text-xl text-[#14201A]">This Week's Training Rack</h2>
              <p className="text-xs text-[rgb(90,102,96)]">6-day progressive resistance & recovery schedule</p>
            </div>
            <Link
              href="/train"
              className="text-xs font-semibold text-[#0B3D2E] hover:underline flex items-center gap-1"
            >
              <CalendarDays className="w-3.5 h-3.5" /> Open Session
            </Link>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const isToday = currentDayOfWeek === d;
              const isDone = weekCompletedDays.includes(d);
              return (
                <div
                  key={d}
                  className={`p-3 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 ${
                    isToday
                      ? 'bg-[#0B3D2E] text-[#F2F7D9] border-[#0B3D2E] shadow-sm'
                      : isDone
                      ? 'bg-[#F2F7D9] text-[#0B3D2E] border-[#0B3D2E]/20'
                      : 'bg-white/60 text-[rgb(90,102,96)] border-[#14201A]/5'
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase">{DAY_NAMES[d]}</span>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-[#3B7A57]" />
                    ) : isToday ? (
                      '●'
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5-Domain Rollup Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Nutrition / Calories */}
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-[rgb(90,102,96)] tracking-wider">
                Fuel & Macros
              </span>
              <Utensils className="w-4 h-4 text-[#0B3D2E]" />
            </div>
            <div>
              <div className="font-serif text-3xl text-[#14201A]">
                {todayCalories}{' '}
                <span className="text-xs font-sans text-[rgb(90,102,96)]">/ {calorieTarget} kcal</span>
              </div>
              <p className="text-xs text-[rgb(90,102,96)] mt-0.5">
                Protein: <strong>{todayProtein}g</strong> / {proteinTarget}g
              </p>
            </div>
            <div className="w-full bg-[#14201A]/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#0B3D2E] h-full rounded-full transition-all"
                style={{ width: `${calPercent}%` }}
              />
            </div>
            <Link
              href="/fuel"
              className="inline-block text-xs font-semibold text-[#0B3D2E] hover:underline"
            >
              + Log Food / View Meals →
            </Link>
          </div>

          {/* 2. Fasting Window */}
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-[rgb(90,102,96)] tracking-wider">
                Fasting Window
              </span>
              <Timer className="w-4 h-4 text-[#C1502E]" />
            </div>
            {activeFast ? (
              <div>
                <div className="font-serif text-3xl text-[#C1502E]">Fasting</div>
                <p className="text-xs text-[rgb(90,102,96)] mt-0.5">
                  Preset: {activeFast.preset} ({activeFast.target_hours}h goal)
                </p>
                <p className="text-xs text-emerald-700 mt-1 font-medium">Eating window locked</p>
              </div>
            ) : (
              <div>
                <div className="font-serif text-3xl text-[rgb(90,102,96)]">Eating Window</div>
                <p className="text-xs text-[rgb(90,102,96)] mt-0.5">No fast active currently.</p>
              </div>
            )}
            <Link
              href="/fasting"
              className="inline-block text-xs font-semibold text-[#0B3D2E] hover:underline"
            >
              {activeFast ? 'Manage Fasting Timer →' : 'Start Fasting Window →'}
            </Link>
          </div>

          {/* 3. Water / Hydration */}
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-[rgb(90,102,96)] tracking-wider">
                Hydration
              </span>
              <Droplets className="w-4 h-4 text-sky-600" />
            </div>
            <div>
              <div className="font-serif text-3xl text-[#14201A]">
                {todayWater}{' '}
                <span className="text-xs font-sans text-[rgb(90,102,96)]">/ {waterTarget} ml</span>
              </div>
              <p className="text-xs text-[rgb(90,102,96)] mt-0.5">Daily goal progress: {waterPercent}%</p>
            </div>
            <div className="w-full bg-[#14201A]/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-sky-600 h-full rounded-full transition-all"
                style={{ width: `${waterPercent}%` }}
              />
            </div>
            <Link
              href="/water"
              className="inline-block text-xs font-semibold text-[#0B3D2E] hover:underline"
            >
              Quick Hydration Log →
            </Link>
          </div>

          {/* 4. Sleep & Alarm */}
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-[rgb(90,102,96)] tracking-wider">
                Sleep & Rest
              </span>
              <Moon className="w-4 h-4 text-indigo-700" />
            </div>
            <div>
              <div className="font-serif text-3xl text-[#14201A]">
                {lastNightSleep
                  ? `${Math.floor(lastNightSleep.duration_minutes / 60)}h ${lastNightSleep.duration_minutes % 60}m`
                  : '7.5h'}
              </div>
              <p className="text-xs text-[rgb(90,102,96)] mt-0.5">
                Target Bedtime: {user?.target_bedtime || '23:00'} (Wind-down: 60m prior)
              </p>
            </div>
            <Link
              href="/sleep"
              className="inline-block text-xs font-semibold text-[#0B3D2E] hover:underline"
            >
              Sleep Scheduler & Alarm →
            </Link>
          </div>

          {/* 5. Resistance Training */}
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-[rgb(90,102,96)] tracking-wider">
                Workouts & Overload
              </span>
              <Dumbbell className="w-4 h-4 text-[#0B3D2E]" />
            </div>
            <div>
              <div className="font-serif text-3xl text-[#14201A]">Active Split</div>
              <p className="text-xs text-[rgb(90,102,96)] mt-0.5">
                Auto-progresses sets and weights with progressive overload.
              </p>
            </div>
            <Link
              href="/train"
              className="inline-block text-xs font-semibold text-[#0B3D2E] hover:underline"
            >
              Start / Log Workout Session →
            </Link>
          </div>

          {/* 6. Quick Weight Log */}
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-5 space-y-3 shadow-xs">
            <span className="text-xs uppercase font-semibold text-[rgb(90,102,96)] tracking-wider block">
              Morning Weigh-In
            </span>
            <form onSubmit={handleQuickWeightSubmit} className="flex gap-2">
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 81.8"
                value={quickWeight}
                onChange={(e) => setQuickWeight(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#14201A]/15 rounded-xl text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9] rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Save
              </button>
            </form>
            {quickWeightSaved && (
              <p className="text-xs text-emerald-700 font-medium">Logged ✓ Saved to trend chart</p>
            )}
            <Link
              href="/track"
              className="inline-block text-xs font-semibold text-[rgb(90,102,96)] hover:underline"
            >
              View Full Body Composition Trend →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
