import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/trainer/clients - Get trainer's assigned clients
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user || user.role !== 'trainer') {
      return NextResponse.json({ error: 'A trainer session is required.' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const trainerId = searchParams.get('trainerId');

    if (trainerId !== user.id) {
      return NextResponse.json({ error: 'You can only view your own client assignments.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: assignments, error } = await supabaseAdmin
      .from('trainer_assignments')
      .select(`
        *,
        client:users!trainer_assignments_client_id_fkey(
          id,
          full_name,
          email,
          phone,
          avatar_url,
          daily_calorie_target,
          daily_protein_target
        ),
        gym:gyms!trainer_assignments_gym_id_fkey(id, name)
      `)
      .eq('trainer_id', trainerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assignments });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/trainer/clients - Assign client to trainer
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin client assignments are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to assign a client.' }, { status: 401 });
    const body = await req.json();
    const {
      gym_id,
      trainer_id,
      client_id,
      assignment_type = 'personal_training',
      sessions_per_week = 3,
      session_duration_minutes = 60,
      notes,
    } = body;

    if (!gym_id || !trainer_id || !client_id) {
      return NextResponse.json(
        { error: 'Gym ID, trainer ID, and client ID are required' },
        { status: 400 }
      );
    }
    if (!(await canConfigureGymPayments(user, gym_id))) {
      return NextResponse.json({ error: 'You are not authorized to assign clients at this gym.' }, { status: 403 });
    }
    if (!['personal_training', 'group_training', 'nutrition_coaching'].includes(assignment_type)) {
      return NextResponse.json({ error: 'Choose a valid coaching assignment type.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const [{ data: trainer, error: trainerError }, { data: client, error: clientError }] = await Promise.all([
      supabaseAdmin
        .from('gym_staff')
        .select('id')
        .eq('gym_id', gym_id)
        .eq('user_id', trainer_id)
        .eq('status', 'active')
        .in('position', ['trainer', 'head_trainer'])
        .maybeSingle(),
      supabaseAdmin
        .from('gym_memberships')
        .select('id')
        .eq('gym_id', gym_id)
        .eq('member_id', client_id)
        .eq('status', 'active')
        .maybeSingle(),
    ]);
    if (trainerError || clientError) {
      return NextResponse.json({ error: trainerError?.message || clientError?.message || 'Could not verify assignment.' }, { status: 500 });
    }
    if (!trainer || !client) {
      return NextResponse.json({ error: 'Choose an active gym trainer and an active gym member.' }, { status: 400 });
    }

    const { data: assignment, error } = await supabaseAdmin
      .from('trainer_assignments')
      .insert({
        gym_id,
        trainer_id,
        client_id,
        assignment_type,
        sessions_per_week,
        session_duration_minutes,
        start_date: new Date().toISOString().split('T')[0],
        status: 'active',
        notes,
      })
      .select(`
        *,
        client:users!trainer_assignments_client_id_fkey(id, full_name, email, phone),
        trainer:users!trainer_assignments_trainer_id_fkey(id, full_name)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, assignment });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
