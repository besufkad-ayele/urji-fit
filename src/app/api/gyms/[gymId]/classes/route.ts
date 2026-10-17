import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/gyms/[gymId]/classes - Get all classes for a gym
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { gymId } = await params;

    const { data: classes, error } = await supabaseAdmin
      .from('classes')
      .select(`
        *,
        trainer:users!classes_trainer_id_fkey(id, full_name, avatar_url),
        bookings:class_bookings(count)
      `)
      .eq('gym_id', gymId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ classes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/gyms/[gymId]/classes - Create new class
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { gymId } = await params;
    const body = await req.json();
    const {
      trainer_id,
      name,
      description,
      class_type,
      day_of_week,
      start_time,
      duration_minutes = 60,
      capacity = 20,
      price = 0,
      difficulty_level,
    } = body;

    if (!name || !class_type || day_of_week === undefined || !start_time) {
      return NextResponse.json(
        { error: 'Class name, type, day, and start time are required' },
        { status: 400 }
      );
    }

    const { data: newClass, error } = await supabaseAdmin
      .from('classes')
      .insert({
        gym_id: gymId,
        trainer_id,
        name,
        description,
        class_type,
        day_of_week,
        start_time,
        duration_minutes,
        capacity,
        price,
        difficulty_level,
        status: 'active',
      })
      .select(`
        *,
        trainer:users!classes_trainer_id_fkey(id, full_name)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, class: newClass });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
