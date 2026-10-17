import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/gyms - Get all gyms (admin) or user's gym (gym_owner)
export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const role = searchParams.get('role');

    if (!userId || !role) {
      return NextResponse.json({ error: 'User ID and role required' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('gyms')
      .select(`
        *,
        owner:users!gyms_owner_id_fkey(id, full_name, email, phone),
        gym_staff(count),
        gym_memberships(count)
      `);

    // Gym owners only see their own gyms
    if (role === 'gym_owner') {
      query = query.eq('owner_id', userId);
    }

    const { data: gyms, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ gyms });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/gyms - Create new gym
export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();
    const {
      name,
      owner_id,
      address,
      city,
      state,
      country = 'Ethiopia',
      phone,
      email,
      description,
      operating_hours,
      amenities,
      capacity = 100,
    } = body;

    if (!name || !owner_id) {
      return NextResponse.json(
        { error: 'Gym name and owner ID are required' },
        { status: 400 }
      );
    }

    const { data: gym, error } = await supabaseAdmin
      .from('gyms')
      .insert({
        name,
        owner_id,
        address,
        city,
        state,
        country,
        phone,
        email,
        description,
        operating_hours,
        amenities,
        capacity,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, gym });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/gyms - Update gym
export async function PATCH(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();
    const { gymId, ...updates } = body;

    if (!gymId) {
      return NextResponse.json({ error: 'Gym ID is required' }, { status: 400 });
    }

    const { data: gym, error } = await supabaseAdmin
      .from('gyms')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', gymId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, gym });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
