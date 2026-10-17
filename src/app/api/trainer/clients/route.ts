import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/trainer/clients - Get trainer's assigned clients
export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const trainerId = searchParams.get('trainerId');

    if (!trainerId) {
      return NextResponse.json({ error: 'Trainer ID is required' }, { status: 400 });
    }

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
  try {
    const supabaseAdmin = getSupabaseAdmin();
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
