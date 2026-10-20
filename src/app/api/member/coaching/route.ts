import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'member') {
      return NextResponse.json({ error: 'A member session is required.' }, { status: 403 });
    }
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: memberships, error: membershipError }, { data: sessions, error: sessionError }] = await Promise.all([
      supabase.from('gym_memberships').select('gym_id')
        .eq('member_id', user.id).eq('status', 'active')
        .lte('start_date', today).or(`end_date.is.null,end_date.gte.${today}`),
      supabase
        .from('workout_sessions')
        .select('id, name, session_date, notes, trainer_program_id, exercise_sets(id, exercise_name, set_number, weight_kg, reps, rpe)')
        .eq('user_id', user.id)
        .not('trainer_program_id', 'is', null)
        .order('session_date', { ascending: false })
        .limit(30),
    ]);
    if (membershipError) throw new Error(`Failed to verify active memberships: ${membershipError.message}`);
    if (sessionError) throw new Error(`Failed to load workout history: ${sessionError.message}`);
    const gymIds = [...new Set((memberships ?? []).map((membership) => membership.gym_id))];
    if (!gymIds.length) return NextResponse.json({ plans: [], sessions: sessions ?? [] });

    const [{ data: programAssignments, error: assignmentError }, { data: activeTrainerLinks, error: linkError }] = await Promise.all([
      supabase
        .from('trainer_program_assignments')
        .select('id, gym_id, trainer_id, client_id, status, assigned_at, program:trainer_programs!inner(id, name, description, nutrition_guidance, status, exercises:trainer_program_exercises(id, name, target_sets, target_reps_min, target_reps_max, video_url, order_index))')
        .eq('client_id', user.id)
        .eq('status', 'active')
        .eq('program.status', 'active')
        .in('gym_id', gymIds)
        .order('assigned_at', { ascending: false }),
      supabase.from('trainer_assignments').select('gym_id, trainer_id')
        .eq('client_id', user.id).eq('status', 'active').in('gym_id', gymIds),
    ]);
    if (assignmentError) throw new Error(`Failed to load assigned training plans: ${assignmentError.message}`);
    if (linkError) throw new Error(`Failed to verify active coaches: ${linkError.message}`);

    const activeLinks = new Set((activeTrainerLinks ?? []).map((link) => `${link.gym_id}:${link.trainer_id}`));
    const trainerIds = [...new Set((programAssignments ?? []).map((assignment) => assignment.trainer_id))];
    const { data: activeStaff, error: staffError } = trainerIds.length
      ? await supabase.from('gym_staff').select('gym_id, user_id')
        .in('gym_id', gymIds).in('user_id', trainerIds).eq('status', 'active')
        .in('position', ['trainer', 'head_trainer'])
      : { data: [], error: null };
    if (staffError) throw new Error(`Failed to verify trainer access: ${staffError.message}`);
    const activeStaffLinks = new Set((activeStaff ?? []).map((staff) => `${staff.gym_id}:${staff.user_id}`));
    const validAssignments = (programAssignments ?? []).filter((assignment) =>
      activeLinks.has(`${assignment.gym_id}:${assignment.trainer_id}`) &&
      activeStaffLinks.has(`${assignment.gym_id}:${assignment.trainer_id}`));
    const validTrainerIds = [...new Set(validAssignments.map((assignment) => assignment.trainer_id))];
    const assignedGymIds = [...new Set(validAssignments.map((assignment) => assignment.gym_id))];
    const [{ data: trainers, error: trainerError }, { data: gyms, error: gymError }] = await Promise.all([
      validTrainerIds.length
        ? supabase.from('users').select('id, full_name, avatar_url').in('id', validTrainerIds)
        : Promise.resolve({ data: [], error: null }),
      assignedGymIds.length
        ? supabase.from('gyms').select('id, name').in('id', assignedGymIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (trainerError || gymError) throw new Error(`Training data loaded, but coach details could not be loaded: ${trainerError?.message ?? gymError?.message}`);
    const trainerById = new Map((trainers ?? []).map((trainer) => [trainer.id, trainer]));
    const gymById = new Map((gyms ?? []).map((gym) => [gym.id, gym]));
    const plans = validAssignments.map((assignment) => ({
      ...assignment,
      trainer: trainerById.get(assignment.trainer_id) ?? null,
      gym: gymById.get(assignment.gym_id) ?? null,
    }));
    return NextResponse.json({ plans, sessions: sessions ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load coaching plans.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
