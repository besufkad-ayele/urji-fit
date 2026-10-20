import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

interface WorkoutSet {
  exercise_id: string;
  weight_kg: number;
  reps: number;
  rpe: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWorkoutSet(value: unknown): value is WorkoutSet {
  if (!isRecord(value)) return false;
  return typeof value.exercise_id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.exercise_id) &&
    typeof value.weight_kg === 'number' && Number.isFinite(value.weight_kg) &&
    value.weight_kg >= 0 && value.weight_kg <= 1000 &&
    typeof value.reps === 'number' && Number.isInteger(value.reps) && value.reps >= 1 && value.reps <= 1000 &&
    (value.rpe === null || (typeof value.rpe === 'number' && Number.isFinite(value.rpe) && value.rpe >= 1 && value.rpe <= 10));
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin workout logs are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'member') {
      return NextResponse.json({ error: 'A member session is required.' }, { status: 403 });
    }
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.assignment_id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.assignment_id) ||
      typeof body.notes !== 'string' || body.notes.length > 2000 ||
      !Array.isArray(body.sets) || body.sets.length < 1 || body.sets.length > 100 ||
      !body.sets.every(isWorkoutSet)) {
      return NextResponse.json({ error: 'Provide a valid assigned program, workout note, and set log.' }, { status: 400 });
    }
    const { data: sessionId, error } = await getSupabaseAdmin().rpc('log_trainer_workout', {
      p_member_id: user.id,
      p_assignment_id: body.assignment_id,
      p_notes: body.notes.trim() || null,
      p_sets: body.sets,
    });
    if (error) {
      const status = error.code === '42501' ? 403 : error.code === '22023' ? 400 : 500;
      if (status === 500) throw new Error(`Could not save workout: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ success: true, session_id: sessionId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save workout.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
