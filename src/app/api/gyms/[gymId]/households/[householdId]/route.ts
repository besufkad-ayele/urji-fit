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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string; householdId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin household changes are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to update household accounts.' }, { status: 401 });
    const { gymId, householdId } = await params;
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
    const { data: savedId, error } = await getSupabaseAdmin().rpc('save_gym_household', {
      p_gym_id: gymId,
      p_household_id: householdId,
      p_name: body.name,
      p_primary_member_id: body.primary_member_id,
      p_member_ids: [...new Set(body.member_ids as string[])],
      p_actor_id: user.id,
    });
    if (error) return databaseError(error);
    return NextResponse.json({ success: true, household_id: savedId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update household.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string; householdId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin household changes are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to dissolve a household account.' }, { status: 401 });
    const { gymId, householdId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can manage household accounts.' }, { status: 403 });
    }
    const { error } = await getSupabaseAdmin().rpc('dissolve_gym_household', {
      p_gym_id: gymId,
      p_household_id: householdId,
      p_actor_id: user.id,
    });
    if (error) return databaseError(error);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to dissolve household.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
