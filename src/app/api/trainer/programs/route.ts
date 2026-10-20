import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

interface ProgramExerciseInput {
  name: string;
  target_sets: number;
  target_reps_min: number;
  target_reps_max: number;
  video_url: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateExercise(value: unknown): value is ProgramExerciseInput {
  if (!isRecord(value)) return false;
  const { name, target_sets, target_reps_min, target_reps_max, video_url } = value;
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 120 &&
    typeof target_sets === 'number' && Number.isInteger(target_sets) && target_sets >= 1 && target_sets <= 20 &&
    typeof target_reps_min === 'number' && Number.isInteger(target_reps_min) && target_reps_min >= 1 && target_reps_min <= 100 &&
    typeof target_reps_max === 'number' && Number.isInteger(target_reps_max) && target_reps_max >= target_reps_min && target_reps_max <= 100 &&
    (video_url === null || (typeof video_url === 'string' && video_url.length <= 2048));
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'trainer') {
      return NextResponse.json({ error: 'A trainer session is required.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data: trainerGyms, error: trainerGymsError } = await supabase
      .from('gym_staff')
      .select('gym_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .in('position', ['trainer', 'head_trainer']);
    if (trainerGymsError) throw new Error(`Failed to verify trainer gym access: ${trainerGymsError.message}`);
    const gymIds = [...new Set((trainerGyms ?? []).map((staffRecord) => staffRecord.gym_id))];
    if (!gymIds.length) return NextResponse.json({ assignments: [], programs: [], sessions: [], gyms: [] });
    const [{ data: assignments, error: assignmentsError }, { data: programs, error: programsError }] = await Promise.all([
      supabase
        .from('trainer_assignments')
        .select('id, gym_id, client_id, assignment_type, sessions_per_week, session_duration_minutes, status, start_date, client:users!trainer_assignments_client_id_fkey(id, full_name, email)')
        .eq('trainer_id', user.id)
        .in('gym_id', gymIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase
        .from('trainer_programs')
        .select('id, gym_id, trainer_id, name, description, nutrition_guidance, status, created_at, exercises:trainer_program_exercises(id, name, target_sets, target_reps_min, target_reps_max, video_url, order_index), assignments:trainer_program_assignments(id, client_id, status)')
        .eq('trainer_id', user.id)
        .in('gym_id', gymIds)
        .order('created_at', { ascending: false }),
    ]);
    if (assignmentsError) throw new Error(`Failed to load client assignments: ${assignmentsError.message}`);
    if (programsError) throw new Error(`Failed to load coach programs: ${programsError.message}`);

    const clientIds = [...new Set((assignments ?? []).map((assignment) => assignment.client_id))];
    const programIds = [...new Set((programs ?? []).map((program) => program.id))];
    const [{ data: sessions, error: sessionsError }, { data: gyms, error: gymsError }] = await Promise.all([
      clientIds.length && programIds.length
      ? supabase
        .from('workout_sessions')
        .select('id, user_id, name, session_date, notes, trainer_program_id, exercise_sets(id, exercise_name, set_number, weight_kg, reps, rpe)')
        .in('user_id', clientIds)
        .in('trainer_program_id', programIds)
        .order('session_date', { ascending: false })
        .limit(100)
      : Promise.resolve({ data: [], error: null }),
      gymIds.length
        ? supabase.from('gyms').select('id, name').in('id', gymIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (sessionsError) throw new Error(`Programs loaded, but member workout history could not be loaded: ${sessionsError.message}`);
    if (gymsError) throw new Error(`Programs loaded, but gym details could not be loaded: ${gymsError.message}`);

    const gymsById = new Map((gyms ?? []).map((gym) => [gym.id, gym]));
    return NextResponse.json({
      assignments: (assignments ?? []).map((assignment) => ({ ...assignment, gym: gymsById.get(assignment.gym_id) ?? null })),
      programs: programs ?? [],
      sessions: sessions ?? [],
      gyms: gyms ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load trainer programs.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin program changes are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'trainer') {
      return NextResponse.json({ error: 'A trainer session is required.' }, { status: 403 });
    }
    const body: unknown = await request.json();
    if (!isRecord(body) || !isUuid(body.gym_id) || typeof body.name !== 'string' ||
      typeof body.description !== 'string' || typeof body.nutrition_guidance !== 'string' ||
      !Array.isArray(body.exercises) || !body.exercises.length || body.exercises.length > 60 ||
      !body.exercises.every(validateExercise) || !Array.isArray(body.client_ids) ||
      body.client_ids.length > 100 || !body.client_ids.every(isUuid)) {
      return NextResponse.json({ error: 'Provide a valid gym, program, exercise prescriptions, and client list.' }, { status: 400 });
    }
    if (body.name.trim().length < 1 || body.name.trim().length > 120 ||
      body.description.length > 2000 || body.nutrition_guidance.length > 4000) {
      return NextResponse.json({ error: 'Program name, description, or nutrition guidance exceeds its allowed length.' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data: programId, error } = await supabase.rpc('create_trainer_program', {
      p_trainer_id: user.id,
      p_gym_id: body.gym_id,
      p_name: body.name.trim(),
      p_description: body.description.trim() || null,
      p_nutrition_guidance: body.nutrition_guidance.trim() || null,
      p_exercises: body.exercises,
      p_client_ids: [...new Set(body.client_ids)],
    });
    if (error) {
      const status = error.code === '42501' ? 403 : error.code === '22023' ? 400 : 500;
      if (status === 500) throw new Error(`Could not create training program: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ success: true, program_id: programId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create training program.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
