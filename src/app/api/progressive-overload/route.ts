import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { userId, exerciseName, targetMaxReps, currentWeight } = await req.json();

    if (!userId || !exerciseName || !targetMaxReps || currentWeight === undefined) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    // Fetch the recent completed sets for this user and exercise
    const { data: recentSets, error } = await supabaseAdmin
      .from('exercise_sets')
      .select('*, workout_sessions!inner(user_id, session_date)')
      .eq('workout_sessions.user_id', userId)
      .eq('exercise_name', exerciseName)
      .eq('is_completed', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !recentSets || recentSets.length < 4) {
      return NextResponse.json({ suggestion: null, reason: 'Not enough history logged yet.' });
    }

    // Group sets by session
    const sessionsMap = new Map<string, typeof recentSets>();
    for (const set of recentSets) {
      const sessId = set.session_id;
      if (!sessionsMap.has(sessId)) {
        sessionsMap.set(sessId, []);
      }
      sessionsMap.get(sessId)!.push(set);
    }

    const sessions = Array.from(sessionsMap.values()).slice(0, 2);
    if (sessions.length < 2) {
      return NextResponse.json({ suggestion: null, reason: 'Need at least 2 distinct completed sessions.' });
    }

    const [session1, session2] = sessions;
    const hitTopS1 = session1.every((s) => s.reps >= targetMaxReps);
    const hitTopS2 = session2.every((s) => s.reps >= targetMaxReps);

    if (hitTopS1 && hitTopS2) {
      const rawIncrease = Math.max(1, Math.min(5, currentWeight * 0.05));
      const suggested = Math.round((currentWeight + rawIncrease) * 2) / 2;
      const reason = `Hit top of rep target (${targetMaxReps} reps) for all sets in 2 consecutive sessions. Ready to advance!`;

      // Insert or update suggestion
      const { data: suggestion, error: insertError } = await supabaseAdmin
        .from('progression_suggestions')
        .insert({
          user_id: userId,
          exercise_name: exerciseName,
          previous_weight_kg: currentWeight,
          suggested_weight_kg: suggested,
          reason,
          status: 'pending',
        })
        .select('*')
        .single();

      if (!insertError && suggestion) {
        return NextResponse.json({ suggestion, upgraded: true });
      }
    }

    return NextResponse.json({ suggestion: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
