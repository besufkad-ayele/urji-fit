import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, canManageGym, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { recordGymAuditEvent } from '@/lib/gym-audit';

const MEMBERSHIP_TYPES = [
  'monthly',
  'quarterly',
  'annual',
  'day_pass',
  'family',
  'corporate',
  'student',
  'couple',
  'pay_per_visit',
  'class_pack',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin plan changes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to manage membership plans.' }, { status: 401 });

    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to manage plans for this gym.' }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'A plan ID and changes are required.' }, { status: 400 });
    }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if ('name' in body) {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100) {
        return NextResponse.json({ error: 'Plan name is required and must be 100 characters or fewer.' }, { status: 400 });
      }
      updates.name = body.name.trim();
    }
    if ('membership_type' in body) {
      if (!MEMBERSHIP_TYPES.includes(body.membership_type as (typeof MEMBERSHIP_TYPES)[number])) {
        return NextResponse.json({ error: 'Choose a valid membership type.' }, { status: 400 });
      }
      updates.membership_type = body.membership_type;
    }
    if ('price' in body) {
      if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0 || body.price > 1_000_000) {
        return NextResponse.json({ error: 'Plan price must be between ETB 0 and ETB 1,000,000.' }, { status: 400 });
      }
      updates.price = body.price;
    }
    for (const field of ['duration_days', 'sessions_included'] as const) {
      if (!(field in body)) continue;
      const value = body[field];
      const maximum = field === 'duration_days' ? 3650 : 10000;
      if (value !== null && (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > maximum)) {
        return NextResponse.json({ error: `${field.replaceAll('_', ' ')} must be between 1 and ${maximum}.` }, { status: 400 });
      }
      updates[field] = value;
    }
    if ('description' in body) {
      if (body.description !== null && (typeof body.description !== 'string' || body.description.length > 1000)) {
        return NextResponse.json({ error: 'Description must be 1,000 characters or fewer.' }, { status: 400 });
      }
      updates.description = typeof body.description === 'string' ? body.description.trim() || null : null;
    }
    if ('is_active' in body) {
      if (typeof body.is_active !== 'boolean') return NextResponse.json({ error: 'Plan availability must be true or false.' }, { status: 400 });
      updates.is_active = body.is_active;
    }
    if (Object.keys(updates).length === 1) return NextResponse.json({ error: 'No plan changes were provided.' }, { status: 400 });

    const { data: plan, error } = await getSupabaseAdmin()
      .from('gym_membership_plans')
      .update(updates)
      .eq('id', body.id)
      .eq('gym_id', gymId)
      .select('*')
      .maybeSingle();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'A plan with this name already exists.' }, { status: 409 });
      throw new Error(`Failed to update membership plan: ${error.message}`);
    }
    if (!plan) return NextResponse.json({ error: 'Membership plan not found.' }, { status: 404 });
    await recordGymAuditEvent({
      gymId,
      actorId: user.id,
      action: body.is_active === false ? 'membership_plan_archived' : body.is_active === true ? 'membership_plan_activated' : 'membership_plan_updated',
      targetType: 'membership_plan',
      targetId: plan.id,
      details: { changed_fields: Object.keys(updates).filter((field) => field !== 'updated_at') },
    });
    return NextResponse.json({ success: true, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update membership plan.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view membership plans.' }, { status: 401 });

    const { gymId } = await params;
    if (!(await canManageGym(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to view plans for this gym.' }, { status: 403 });
    }

    const { data: plans, error } = await getSupabaseAdmin()
      .from('gym_membership_plans')
      .select('*')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load membership plans: ${error.message}`);
    return NextResponse.json({ plans });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load membership plans.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin plan changes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to manage membership plans.' }, { status: 401 });

    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to manage plans for this gym.' }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (!isRecord(body)) return NextResponse.json({ error: 'Plan data must be an object.' }, { status: 400 });

    const { name, membership_type, price, duration_days, sessions_included, description } = body;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
      return NextResponse.json({ error: 'Plan name is required and must be 100 characters or fewer.' }, { status: 400 });
    }
    if (!MEMBERSHIP_TYPES.includes(membership_type as (typeof MEMBERSHIP_TYPES)[number])) {
      return NextResponse.json({ error: 'Choose a valid membership type.' }, { status: 400 });
    }
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 1_000_000) {
      return NextResponse.json({ error: 'Plan price must be between ETB 0 and ETB 1,000,000.' }, { status: 400 });
    }
    if (
      duration_days !== null &&
      duration_days !== undefined &&
      (typeof duration_days !== 'number' || !Number.isInteger(duration_days) || duration_days < 1 || duration_days > 3650)
    ) {
      return NextResponse.json({ error: 'Duration must be between 1 and 3,650 days.' }, { status: 400 });
    }
    if (
      sessions_included !== null &&
      sessions_included !== undefined &&
      (typeof sessions_included !== 'number' || !Number.isInteger(sessions_included) || sessions_included < 1 || sessions_included > 10000)
    ) {
      return NextResponse.json({ error: 'Included sessions must be between 1 and 10,000.' }, { status: 400 });
    }
    if (description !== null && description !== undefined && (typeof description !== 'string' || description.length > 1000)) {
      return NextResponse.json({ error: 'Description must be 1,000 characters or fewer.' }, { status: 400 });
    }

    const { data: plan, error } = await getSupabaseAdmin()
      .from('gym_membership_plans')
      .insert({
        gym_id: gymId,
        name: name.trim(),
        membership_type,
        price,
        duration_days: duration_days ?? null,
        sessions_included: sessions_included ?? null,
        description: typeof description === 'string' ? description.trim() || null : null,
      })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'A plan with this name already exists.' }, { status: 409 });
      throw new Error(`Failed to create membership plan: ${error.message}`);
    }

    await recordGymAuditEvent({
      gymId,
      actorId: user.id,
      action: 'membership_plan_created',
      targetType: 'membership_plan',
      targetId: plan.id,
      details: { name: plan.name, membership_type: plan.membership_type, price_etb: plan.price },
    });
    return NextResponse.json({ success: true, plan }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create membership plan.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
