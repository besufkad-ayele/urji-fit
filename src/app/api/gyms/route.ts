import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// GET /api/gyms - Get all gyms (admin) or user's gym (gym_owner)
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to view gyms.' }, { status: 401 });
    if (!['gym_owner', 'admin', 'platform_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'You are not authorized to view gym management data.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from('gyms')
      .select(`
        *,
        owner:users!gyms_owner_id_fkey(id, full_name, email, phone),
        gym_staff(count),
        gym_memberships(count)
      `);

    // Gym owners only see their own gyms
    if (user.role === 'gym_owner') {
      query = query.eq('owner_id', user.id);
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
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin gym creation is not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user || !['admin', 'platform_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'An administrator session is required to create a gym.' }, { status: 403 });
    }
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

    if (typeof name !== 'string' || !name.trim() || typeof owner_id !== 'string' || !owner_id) {
      return NextResponse.json(
        { error: 'Gym name and owner ID are required.' },
        { status: 400 }
      );
    }

    const { data: owner, error: ownerError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', owner_id)
      .maybeSingle();
    if (ownerError) {
      return NextResponse.json({ error: `Could not verify gym owner: ${ownerError.message}` }, { status: 500 });
    }
    if (!owner || owner.role !== 'gym_owner') {
      return NextResponse.json({ error: 'Choose an existing account with the Gym Owner role.' }, { status: 400 });
    }

    const { data: gym, error } = await supabaseAdmin
      .from('gyms')
      .insert({
        name: name.trim(),
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
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin gym updates are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to update gym settings.' }, { status: 401 });
    const body: unknown = await req.json();
    if (!isRecord(body) || !('gymId' in body)) {
      return NextResponse.json({ error: 'Gym ID is required' }, { status: 400 });
    }
    const gymId = body.gymId;
    if (typeof gymId !== 'string' || !(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to update this gym.' }, { status: 403 });
    }

    if ('owner_id' in body && user.role !== 'admin' && user.role !== 'platform_admin') {
      return NextResponse.json({ error: 'Only an administrator can assign a gym owner.' }, { status: 403 });
    }
    if ('owner_id' in body) {
      if (typeof body.owner_id !== 'string' || !body.owner_id) {
        return NextResponse.json({ error: 'A valid gym-owner account is required.' }, { status: 400 });
      }
      const supabaseAdmin = getSupabaseAdmin();
      const { data: owner, error: ownerError } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .eq('id', body.owner_id)
        .maybeSingle();
      if (ownerError) {
        return NextResponse.json({ error: `Could not verify gym owner: ${ownerError.message}` }, { status: 500 });
      }
      if (!owner || owner.role !== 'gym_owner') {
        return NextResponse.json({ error: 'Choose an existing account with the Gym Owner role.' }, { status: 400 });
      }
    }

    const editableFields = [
      'name',
      'address',
      'city',
      'state',
      'zip_code',
      'country',
      'phone',
      'email',
      'website',
      'logo_url',
      'description',
      'operating_hours',
      'amenities',
      'capacity',
    ] as const;
    const updates: Record<string, unknown> = {};
    for (const field of editableFields) {
      if (field in body) updates[field] = body[field];
    }
    if ('owner_id' in body) updates.owner_id = body.owner_id;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No editable gym fields were provided.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
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
