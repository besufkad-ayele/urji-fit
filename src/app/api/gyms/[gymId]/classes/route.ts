import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, canManageGym, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { recordGymAuditEvent } from '@/lib/gym-audit';

const classTypes = ['yoga', 'pilates', 'spin', 'hiit', 'crossfit', 'boxing', 'zumba', 'strength', 'cardio', 'flexibility', 'functional', 'other'];
const difficultyLevels = ['beginner', 'intermediate', 'advanced', 'all_levels'];

// GET /api/gyms/[gymId]/classes - Get all classes for a gym
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to view the class schedule.' }, { status: 401 });
    const { gymId } = await params;
    if (user.role === 'member') {
      const { data: membership, error: membershipError } = await getSupabaseAdmin()
        .from('gym_memberships')
        .select('id')
        .eq('gym_id', gymId)
        .eq('member_id', user.id)
        .eq('status', 'active')
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString().slice(0, 10)}`)
        .maybeSingle();
      if (membershipError) {
        return NextResponse.json({ error: `Could not verify gym access: ${membershipError.message}` }, { status: 500 });
      }
      if (!membership) return NextResponse.json({ error: 'An active membership is required to view this schedule.' }, { status: 403 });
    } else if (!(await canManageGym(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to view this class schedule.' }, { status: 403 });
    }
    const supabaseAdmin = getSupabaseAdmin();

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
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin class changes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to manage classes.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to manage classes for this gym.' }, { status: 403 });
    }
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
    if (!Number.isInteger(day_of_week) || day_of_week < 0 || day_of_week > 6) {
      return NextResponse.json({ error: 'Choose a valid day of the week.' }, { status: 400 });
    }
    if (
      !Number.isInteger(duration_minutes) ||
      duration_minutes < 1 ||
      duration_minutes > 480 ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 500 ||
      typeof price !== 'number' ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 9_999.99
    ) {
      return NextResponse.json({ error: 'Duration, capacity, or class price is invalid.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (trainer_id) {
      const { data: trainer, error: trainerError } = await supabaseAdmin
        .from('gym_staff')
        .select('id')
        .eq('gym_id', gymId)
        .eq('user_id', trainer_id)
        .eq('status', 'active')
        .in('position', ['trainer', 'head_trainer'])
        .maybeSingle();
      if (trainerError) {
        return NextResponse.json({ error: `Could not verify trainer: ${trainerError.message}` }, { status: 500 });
      }
      if (!trainer) return NextResponse.json({ error: 'Choose an active trainer at this gym.' }, { status: 400 });
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

    await recordGymAuditEvent({
      gymId,
      actorId: user.id,
      action: 'class_created',
      targetType: 'class',
      targetId: newClass.id,
      details: { name: newClass.name, class_type: newClass.class_type },
    });
    return NextResponse.json({ success: true, class: newClass });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin class changes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to manage classes.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to manage classes for this gym.' }, { status: 403 });
    }
    const body: unknown = await req.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Class changes must be an object.' }, { status: 400 });
    }
    const { classId, ...input } = body as Record<string, unknown>;
    if (typeof classId !== 'string' || !classId) {
      return NextResponse.json({ error: 'Class ID is required.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if ('name' in input) {
      if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120) {
        return NextResponse.json({ error: 'Class name is required and must be 120 characters or fewer.' }, { status: 400 });
      }
      updates.name = input.name.trim();
    }
    if ('description' in input) {
      if (input.description !== null && (typeof input.description !== 'string' || input.description.length > 2000)) {
        return NextResponse.json({ error: 'Class description must be 2,000 characters or fewer.' }, { status: 400 });
      }
      updates.description = input.description;
    }
    if ('class_type' in input) {
      if (typeof input.class_type !== 'string' || !classTypes.includes(input.class_type)) {
        return NextResponse.json({ error: 'Choose a valid class type.' }, { status: 400 });
      }
      updates.class_type = input.class_type;
    }
    if ('day_of_week' in input) {
      if (!Number.isInteger(input.day_of_week) || (input.day_of_week as number) < 0 || (input.day_of_week as number) > 6) {
        return NextResponse.json({ error: 'Choose a valid day of the week.' }, { status: 400 });
      }
      updates.day_of_week = input.day_of_week;
    }
    if ('start_time' in input) {
      if (typeof input.start_time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.start_time)) {
        return NextResponse.json({ error: 'Class start time must use HH:MM format.' }, { status: 400 });
      }
      updates.start_time = input.start_time;
    }
    for (const field of ['duration_minutes', 'capacity'] as const) {
      if (field in input) {
        const value = input[field];
        const max = field === 'duration_minutes' ? 480 : 500;
        if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > max) {
          return NextResponse.json({ error: `${field === 'capacity' ? 'Capacity' : 'Duration'} is invalid.` }, { status: 400 });
        }
        updates[field] = value;
      }
    }
    if ('price' in input) {
      if (typeof input.price !== 'number' || !Number.isFinite(input.price) || input.price < 0 || input.price > 9_999.99) {
        return NextResponse.json({ error: 'Class price must be between ETB 0 and ETB 9,999.99.' }, { status: 400 });
      }
      updates.price = input.price;
    }
    if ('difficulty_level' in input) {
      if (input.difficulty_level !== null && (typeof input.difficulty_level !== 'string' || !difficultyLevels.includes(input.difficulty_level))) {
        return NextResponse.json({ error: 'Choose a valid difficulty level.' }, { status: 400 });
      }
      updates.difficulty_level = input.difficulty_level;
    }
    if ('trainer_id' in input) {
      if (input.trainer_id !== null && typeof input.trainer_id !== 'string') {
        return NextResponse.json({ error: 'Choose a valid trainer.' }, { status: 400 });
      }
      updates.trainer_id = input.trainer_id;
    }
    if ('status' in input) {
      if (input.status !== 'active' && input.status !== 'canceled') {
        return NextResponse.json({ error: 'Class status must be active or canceled.' }, { status: 400 });
      }
      updates.status = input.status;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Provide at least one class change.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (updates.trainer_id) {
      const { data: trainer, error: trainerError } = await supabase
        .from('gym_staff')
        .select('id')
        .eq('gym_id', gymId)
        .eq('user_id', updates.trainer_id)
        .eq('status', 'active')
        .in('position', ['trainer', 'head_trainer'])
        .maybeSingle();
      if (trainerError) throw new Error(`Could not verify trainer: ${trainerError.message}`);
      if (!trainer) return NextResponse.json({ error: 'Choose an active trainer at this gym.' }, { status: 400 });
    }

    const { data: updatedClass, error } = await supabase
      .from('classes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', classId)
      .eq('gym_id', gymId)
      .select('*, trainer:users!classes_trainer_id_fkey(id, full_name)')
      .maybeSingle();
    if (error) throw new Error(`Failed to update class: ${error.message}`);
    if (!updatedClass) return NextResponse.json({ error: 'Class not found.' }, { status: 404 });

    await recordGymAuditEvent({
      gymId,
      actorId: user.id,
      action: updatedClass.status === 'canceled' ? 'class_deactivated' : 'class_updated',
      targetType: 'class',
      targetId: updatedClass.id,
      details: { changed_fields: Object.keys(updates) },
    });
    return NextResponse.json({ success: true, class: updatedClass });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
