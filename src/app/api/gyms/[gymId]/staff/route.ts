import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/gyms/[gymId]/staff - Get all staff for a gym
export async function GET(
  req: NextRequest,
  { params }: { params: { gymId: string } }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const gymId = params.gymId;

    const { data: staff, error } = await supabaseAdmin
      .from('gym_staff')
      .select(`
        *,
        user:users!gym_staff_user_id_fkey(
          id,
          full_name,
          email,
          phone,
          avatar_url,
          bio,
          certifications,
          specializations
        )
      `)
      .eq('gym_id', gymId)
      .order('hire_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ staff });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/gyms/[gymId]/staff - Add new staff member
export async function POST(
  req: NextRequest,
  { params }: { params: { gymId: string } }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const gymId = params.gymId;
    const body = await req.json();
    const {
      user_id,
      position,
      hire_date,
      hourly_rate,
      salary,
      commission_rate,
    } = body;

    if (!user_id || !position) {
      return NextResponse.json(
        { error: 'User ID and position are required' },
        { status: 400 }
      );
    }

    const { data: staffMember, error } = await supabaseAdmin
      .from('gym_staff')
      .insert({
        gym_id: gymId,
        user_id,
        position,
        hire_date: hire_date || new Date().toISOString().split('T')[0],
        hourly_rate,
        salary,
        commission_rate,
        status: 'active',
      })
      .select(`
        *,
        user:users!gym_staff_user_id_fkey(id, full_name, email, phone)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, staff: staffMember });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/gyms/[gymId]/staff - Update staff member
export async function PATCH(
  req: NextRequest,
  { params }: { params: { gymId: string } }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();
    const { staffId, ...updates } = body;

    if (!staffId) {
      return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });
    }

    const { data: staffMember, error } = await supabaseAdmin
      .from('gym_staff')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', staffId)
      .select(`
        *,
        user:users!gym_staff_user_id_fkey(id, full_name, email, phone)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, staff: staffMember });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
