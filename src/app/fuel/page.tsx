'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navigation from '@/components/Navigation';
import { useUserSession } from '@/hooks/useUserSession';
import { supabase } from '@/lib/supabase';
import { FoodLog, FastingWindow } from '@/types';
import { Plus, Utensils, AlertTriangle, Check, Trash2, Sparkles } from 'lucide-react';

const ETHIOPIAN_STAPLE_MEALS = [
  {
    time: '5:15–5:40 AM',
    label: 'Pre-workout',
    food: '1 banana + black coffee or water',
    cals: 105,
    prot: 1.3,
    notes: 'Light carbs. No need to force food if training comfortably fasted.',
  },
  {
    time: '7:30–8:00 AM',
    label: 'Breakfast',
    food: '3 eggs + oats or whole-grain bread + fruit',
    cals: 480,
    prot: 26,
    notes: 'Substantial protein serving to kickstart muscle protein synthesis.',
  },
  {
    time: '12:30–1:30 PM',
    label: 'Lunch',
    food: 'Injera / rice / potato + chicken, fish, or lentils (misir)',
    cals: 650,
    prot: 38,
    notes: 'Moderate starch, generous protein. Go easy on extra oil in sauces.',
  },
  {
    time: '4:00–5:00 PM',
    label: 'Snack',
    food: 'Plain yogurt / milk + fruit or 2 boiled eggs',
    cals: 240,
    prot: 16,
    notes: 'Protein-centered afternoon recharge.',
  },
  {
    time: '7:00–8:00 PM',
    label: 'Dinner',
    food: 'Chicken, fish, eggs or lentils + vegetables + light starch',
    cals: 520,
    prot: 34,
    notes: 'Avoid turning dinner into the heaviest meal before sleep.',
  },
  {
    time: 'Anytime',
    label: 'Healthy Fat',
    food: '¼–½ avocado with meal',
    cals: 120,
    prot: 1.5,
    notes: 'Nutrient-dense healthy fats — portion matters.',
  },
];

export default function FuelPage() {
  const { user } = useUserSession();
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [activeFast, setActiveFast] = useState<FastingWindow | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [fastingWarningModal, setFastingWarningModal] = useState(false);
  const [pendingMealData, setPendingMealData] = useState<{
    meal_type: FoodLog['meal_type'];
    food_name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  } | null>(null);

  // Form fields
  const [mealType, setMealType] = useState<FoodLog['meal_type']>('breakfast');
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('400');
  const [protein, setProtein] = useState('25');
  const [carbs, setCarbs] = useState('35');
  const [fat, setFat] = useState('12');

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchFoodAndFasting = useCallback(async () => {
    if (!user) return;
    // 1. Food logs
    const { data: food } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', todayStr)
      .order('logged_at');

    if (food) setLogs(food as FoodLog[]);

    // 2. Active fast
    const { data: fast } = await supabase
      .from('fasting_windows')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setActiveFast(fast as FastingWindow | null);
  }, [user, todayStr]);

  useEffect(() => {
    fetchFoodAndFasting();
  }, [fetchFoodAndFasting]);

  const executeAddFood = async (mealData: {
    meal_type: FoodLog['meal_type'];
    food_name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }, completeFast: boolean) => {
    if (!user) return;
    try {
      const { data: foodLog } = await supabase
        .from('food_logs')
        .insert({
          user_id: user.id,
          log_date: todayStr,
          meal_type: mealData.meal_type,
          food_name: mealData.food_name,
          calories: mealData.calories,
          protein_g: mealData.protein_g,
          carbs_g: mealData.carbs_g,
          fat_g: mealData.fat_g,
        })
        .select('*')
        .single();

      if (completeFast && activeFast && foodLog) {
        await supabase
          .from('fasting_windows')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
            broken_by_food_log_id: foodLog.id,
          })
          .eq('id', activeFast.id);
        setActiveFast(null);
      }

      setShowLogModal(false);
      setFastingWarningModal(false);
      setPendingMealData(null);
      setFoodName('');
      fetchFoodAndFasting();
    } catch {
      alert('Error saving food log');
    }
  };

  const handleAttemptAdd = (mealData: {
    meal_type: FoodLog['meal_type'];
    food_name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }) => {
    if (activeFast) {
      setPendingMealData(mealData);
      setFastingWarningModal(true);
    } else {
      executeAddFood(mealData, false);
    }
  };

  const handleDeleteFood = async (id: string) => {
    await supabase.from('food_logs').delete().eq('id', id);
    fetchFoodAndFasting();
  };

  const totalCals = logs.reduce((s, l) => s + (l.calories || 0), 0);
  const totalProt = logs.reduce((s, l) => s + (Number(l.protein_g) || 0), 0);
  const totalCarbs = logs.reduce((s, l) => s + (Number(l.carbs_g) || 0), 0);
  const totalFat = logs.reduce((s, l) => s + (Number(l.fat_g) || 0), 0);

  const calTarget = user?.daily_calorie_target || 2000;
  const protTarget = user?.daily_protein_target || 150;
  const carbTarget = user?.daily_carb_target || 200;
  const fatTarget = user?.daily_fat_target || 60;

  return (
    <div className="flex min-h-screen bg-[#F3EFE5]">
      <Navigation userFullName={user?.full_name} userRole={user?.role} />

      <main className="flex-1 p-5 md:p-10 pb-24 md:pb-10 max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-[#0B3D2E] mb-1">
              Nutrition & Macros
            </div>
            <h1 className="font-serif text-3xl md:text-4xl text-[#0B3D2E] font-medium tracking-tight">
              Fuel Planner
            </h1>
            <p className="text-sm text-[rgb(90,102,96)] mt-0.5">
              Protein-forward nutrition built around Ethiopian staples. Portion starch, don't eliminate it.
            </p>
          </div>

          <button
            onClick={() => setShowLogModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0B3D2E] hover:bg-[#135440] text-[#F2F7D9] rounded-xl text-xs font-semibold shadow-sm transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Log Custom Meal
          </button>
        </div>

        {/* Daily Macros Card */}
        <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl text-[#14201A]">Today's Intake</h2>
            <span className="text-xs font-mono font-bold text-[#0B3D2E] bg-[#F2F7D9] px-2.5 py-1 rounded-full">
              {totalCals} / {calTarget} kcal
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-[#F3EFE5]/50 border border-[#14201A]/5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-[rgb(90,102,96)]">Protein</span>
              <div className="font-serif text-2xl text-[#0B3D2E] mt-0.5">{Math.round(totalProt)}g</div>
              <span className="text-[10px] text-[rgb(90,102,96)]">Target: {protTarget}g</span>
            </div>

            <div className="p-3 bg-[#F3EFE5]/50 border border-[#14201A]/5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-[rgb(90,102,96)]">Carbohydrates</span>
              <div className="font-serif text-2xl text-[#14201A] mt-0.5">{Math.round(totalCarbs)}g</div>
              <span className="text-[10px] text-[rgb(90,102,96)]">Target: {carbTarget}g</span>
            </div>

            <div className="p-3 bg-[#F3EFE5]/50 border border-[#14201A]/5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-[rgb(90,102,96)]">Healthy Fats</span>
              <div className="font-serif text-2xl text-[#C1502E] mt-0.5">{Math.round(totalFat)}g</div>
              <span className="text-[10px] text-[rgb(90,102,96)]">Target: {fatTarget}g</span>
            </div>
          </div>
        </div>

        {/* Logged Meals Today */}
        <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="font-serif text-2xl text-[#14201A]">Logged Today ({logs.length})</h2>
          {logs.length === 0 ? (
            <p className="text-xs text-[rgb(90,102,96)] italic">No meals logged yet today.</p>
          ) : (
            <div className="divide-y divide-[#14201A]/5">
              {logs.map((log) => (
                <div key={log.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#C1502E] tracking-wider">
                      {log.meal_type}
                    </span>
                    <h3 className="text-sm font-medium text-[#14201A]">{log.food_name}</h3>
                    <p className="text-xs text-[rgb(90,102,96)]">
                      {log.calories} kcal · {log.protein_g}g P · {log.carbs_g}g C · {log.fat_g}g F
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteFood(log.id)}
                    className="p-1.5 text-[rgb(90,102,96)] hover:text-red-600 rounded-md"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ethiopian Staples Reference & Quick-Add */}
        <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-6 shadow-xs space-y-4">
          <div>
            <h2 className="font-serif text-2xl text-[#14201A]">Staples & Meal Guide</h2>
            <p className="text-xs text-[rgb(90,102,96)]">Tap any item to quick-log it to today's fuel diary.</p>
          </div>

          <div className="space-y-2.5">
            {ETHIOPIAN_STAPLE_MEALS.map((staple, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-white border border-[#14201A]/10 rounded-xl hover:border-[#0B3D2E]/30 transition-all flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-[#0B3D2E] bg-[#F2F7D9] px-2 py-0.5 rounded">
                      {staple.label}
                    </span>
                    <span className="text-xs text-[rgb(90,102,96)] font-mono">{staple.time}</span>
                  </div>
                  <h3 className="text-sm font-medium text-[#14201A] mt-1">{staple.food}</h3>
                  <p className="text-xs text-[rgb(90,102,96)] mt-0.5">{staple.notes}</p>
                </div>

                <button
                  onClick={() =>
                    handleAttemptAdd({
                      meal_type: staple.label.toLowerCase() as FoodLog['meal_type'],
                      food_name: staple.food,
                      calories: staple.cals,
                      protein_g: staple.prot,
                      carbs_g: 25,
                      fat_g: 8,
                    })
                  }
                  className="px-3 py-1.5 bg-[#F3EFE5] hover:bg-[#0B3D2E] hover:text-[#F2F7D9] text-[#0B3D2E] border border-[#14201A]/10 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Quick Log
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Fasting Sync Warning Prompt */}
      {fastingWarningModal && pendingMealData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-[#C1502E]/10 text-[#C1502E] flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-serif text-2xl text-[#14201A] font-medium">
                Active Fast in Progress
              </h2>
              <p className="text-xs text-[rgb(90,102,96)] mt-1">
                You currently have an active <strong>{activeFast?.preset}</strong> fasting window running. Logging a meal will conclude your fast and open your eating window.
              </p>
            </div>

            <div className="p-3 bg-[#F2F7D9] border border-[#0B3D2E]/20 rounded-xl text-xs text-[#0B3D2E]">
              Logging: <strong>{pendingMealData.food_name}</strong> ({pendingMealData.calories} kcal)
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setFastingWarningModal(false);
                  setPendingMealData(null);
                }}
                className="flex-1 py-2.5 bg-black/5 rounded-xl text-xs font-semibold text-[rgb(90,102,96)]"
              >
                Cancel
              </button>
              <button
                onClick={() => executeAddFood(pendingMealData, true)}
                className="flex-1 py-2.5 bg-[#0B3D2E] text-[#F2F7D9] rounded-xl text-xs font-semibold shadow-sm"
              >
                End Fast & Log Meal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Food Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl">
            <h2 className="font-serif text-2xl text-[#0B3D2E] font-medium mb-1">Log Food</h2>
            <p className="text-xs text-[rgb(90,102,96)] mb-4">Enter item and nutritional values.</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAttemptAdd({
                  meal_type: mealType,
                  food_name: foodName,
                  calories: parseInt(calories) || 0,
                  protein_g: parseFloat(protein) || 0,
                  carbs_g: parseFloat(carbs) || 0,
                  fat_g: parseFloat(fat) || 0,
                });
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                  Meal Type
                </label>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as FoodLog['meal_type'])}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                >
                  <option value="pre-workout">Pre-workout</option>
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="snack">Snack</option>
                  <option value="dinner">Dinner</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                  Food Item
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tibs with 1/2 Injera"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                    Calories (kcal)
                  </label>
                  <input
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                    Protein (g)
                  </label>
                  <input
                    type="number"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                    Carbs (g)
                  </label>
                  <input
                    type="number"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[rgb(90,102,96)] mb-1">
                    Fats (g)
                  </label>
                  <input
                    type="number"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-[#14201A]/15 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-[#14201A]/10">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="flex-1 py-2.5 bg-black/5 rounded-xl text-xs font-semibold text-[rgb(90,102,96)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#0B3D2E] text-[#F2F7D9] rounded-xl text-xs font-semibold shadow-sm"
                >
                  Add Meal Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
