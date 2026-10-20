import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { recordGymAuditEvent } from '@/lib/gym-audit';
import { getSupabaseAdmin } from '@/lib/supabase';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to manage promo codes.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can manage promo codes.' }, { status: 403 });
    }
    const { data: promoCodes, error } = await getSupabaseAdmin()
      .from('gym_promo_codes')
      .select('id, code, discount_type, discount_value, starts_at, expires_at, max_redemptions, redemption_count, is_active, created_at')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load promo codes: ${error.message}`);
    return NextResponse.json({ promo_codes: promoCodes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load promo codes.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin promo changes are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to create a promo code.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can create promo codes.' }, { status: 403 });
    }
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.code !== 'string' || (body.discount_type !== 'percentage' && body.discount_type !== 'fixed') || typeof body.discount_value !== 'number') {
      return NextResponse.json({ error: 'Code, discount type, and discount value are required.' }, { status: 400 });
    }
    const code = body.code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)) return NextResponse.json({ error: 'Code must contain 3 to 40 letters, numbers, hyphens, or underscores.' }, { status: 400 });
    const maximum = body.discount_type === 'percentage' ? 100 : 1000000;
    if (!Number.isFinite(body.discount_value) || body.discount_value <= 0 || body.discount_value > maximum || Math.round(body.discount_value * 100) !== body.discount_value * 100) {
      return NextResponse.json({ error: `Discount must be greater than zero and no more than ${maximum}${body.discount_type === 'percentage' ? '%' : ' ETB'}.` }, { status: 400 });
    }
    const maxRedemptions = body.max_redemptions ?? null;
    if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || Number(maxRedemptions) < 1 || Number(maxRedemptions) > 1000000)) {
      return NextResponse.json({ error: 'Maximum redemptions must be a positive whole number.' }, { status: 400 });
    }
    const startDate = typeof body.starts_at === 'string' && body.starts_at ? new Date(body.starts_at) : null;
    const expiryDate = typeof body.expires_at === 'string' && body.expires_at ? new Date(body.expires_at) : null;
    if ((startDate && Number.isNaN(startDate.getTime())) || (expiryDate && Number.isNaN(expiryDate.getTime()))) {
      return NextResponse.json({ error: 'Promo start and expiry must be valid dates.' }, { status: 400 });
    }
    const startsAt = startDate?.toISOString() ?? null;
    const expiresAt = expiryDate?.toISOString() ?? null;
    if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) {
      return NextResponse.json({ error: 'Expiry must be after the start date.' }, { status: 400 });
    }
    const { data: promo, error } = await getSupabaseAdmin()
      .from('gym_promo_codes')
      .insert({
        gym_id: gymId,
        code,
        discount_type: body.discount_type,
        discount_value: body.discount_value,
        starts_at: startsAt,
        expires_at: expiresAt,
        max_redemptions: maxRedemptions,
        created_by: user.id,
      })
      .select('id, code, discount_type, discount_value, starts_at, expires_at, max_redemptions, redemption_count, is_active')
      .single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'That promo code already exists for this gym.' }, { status: 409 });
      throw new Error(`Failed to create promo code: ${error.message}`);
    }
    await recordGymAuditEvent({
      gymId, actorId: user.id, action: 'promo_code_created', targetType: 'promo_code', targetId: promo.id,
      details: { code, discount_type: body.discount_type, discount_value: body.discount_value },
    });
    return NextResponse.json({ success: true, promo_code: promo }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create promo code.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin promo changes are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to update a promo code.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can update promo codes.' }, { status: 403 });
    }
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.id !== 'string' || typeof body.is_active !== 'boolean') {
      return NextResponse.json({ error: 'Promo ID and active status are required.' }, { status: 400 });
    }
    const { data: promo, error } = await getSupabaseAdmin()
      .from('gym_promo_codes')
      .update({ is_active: body.is_active })
      .eq('id', body.id)
      .eq('gym_id', gymId)
      .select('id, code, is_active')
      .maybeSingle();
    if (error) throw new Error(`Failed to update promo code: ${error.message}`);
    if (!promo) return NextResponse.json({ error: 'Promo code not found.' }, { status: 404 });
    await recordGymAuditEvent({ gymId, actorId: user.id, action: body.is_active ? 'promo_code_activated' : 'promo_code_deactivated', targetType: 'promo_code', targetId: promo.id, details: { code: promo.code } });
    return NextResponse.json({ success: true, promo_code: promo });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update promo code.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
