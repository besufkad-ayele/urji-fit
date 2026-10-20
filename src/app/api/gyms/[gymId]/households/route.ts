import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function databaseError(error: { code?: string; message: string }): NextResponse {
  const status = error.code === 'P0002' ? 404 : error.code === '23505' ? 409 : error.code === '22023' ? 400 : 500;
  return NextResponse.json({ error: error.message }, { status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view household accounts.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can manage household accounts.' }, { status: 403 });
    }

    const { data: households, error } = await getSupabaseAdmin()
      .from('gym_households')
      .select(`
        id,
        gym_id,
        name,
        primary_member_id,
        is_active,
        created_at,
        primary_member:users!gym_households_primary_member_id_fkey(id, full_name, email, phone),
        members:gym_household_members(id, member_id, relationship, member:users!gym_household_members_member_id_fkey(id, full_name, email, phone))
      `)
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load households: ${error.message}`);
    return NextResponse.json({ households });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load households.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin household changes are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to create a household account.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can manage household accounts.' }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.name !== 'string' || typeof body.primary_member_id !== 'string' || !Array.isArray(body.member_ids)) {
      return NextResponse.json({ error: 'Household name, primary payer, and member list are required.' }, { status: 400 });
    }
    if (body.member_ids.length > 50 || body.member_ids.some((id) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'A household can include up to 50 member accounts.' }, { status: 400 });
    }
    const memberIds = [...new Set(body.member_ids as string[])];
    const { data: householdId, error } = await getSupabaseAdmin().rpc('save_gym_household', {
      p_gym_id: gymId,
      p_household_id: null,
      p_name: body.name,
      p_primary_member_id: body.primary_member_id,
      p_member_ids: memberIds,
      p_actor_id: user.id,
    });
    if (error) return databaseError(error);
    return NextResponse.json({ success: true, household_id: householdId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create household.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
