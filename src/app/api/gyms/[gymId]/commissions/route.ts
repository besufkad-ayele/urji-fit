import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSameOrigin(request: NextRequest): boolean {
  return request.headers.get('origin') === request.nextUrl.origin;
}

async function trainerHasGymAccess(trainerId: string, gymId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from('gym_staff')
    .select('id')
    .eq('gym_id', gymId)
    .eq('user_id', trainerId)
    .eq('status', 'active')
    .in('position', ['trainer', 'head_trainer'])
    .maybeSingle();
  if (error) throw new Error(`Could not verify trainer access: ${error.message}`);
  return Boolean(data);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view trainer commissions.' }, { status: 401 });
    const { gymId } = await params;
    if (!UUID_PATTERN.test(gymId)) return NextResponse.json({ error: 'A valid gym is required.' }, { status: 400 });
    const isManager = await canConfigureGymPayments(user, gymId);
    if (!isManager && (user.role !== 'trainer' || !(await trainerHasGymAccess(user.id, gymId)))) {
      return NextResponse.json({ error: 'You are not authorized to view commissions for this gym.' }, { status: 403 });
    }
    const supabase = getSupabaseAdmin();
    let commissionsQuery = supabase
      .from('gym_commissions')
      .select('id, booking_id, trainer_id, amount, currency, status, note, created_at, paid_at, trainer:users!gym_commissions_trainer_id_fkey(id, full_name), booking:class_bookings!gym_commissions_booking_id_fkey(booking_date, class:classes!class_bookings_class_id_fkey(name), member:users!class_bookings_member_id_fkey(full_name))')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (user.role === 'trainer') commissionsQuery = commissionsQuery.eq('trainer_id', user.id);
    const { data: commissions, error } = await commissionsQuery;
    if (error) throw new Error(`Failed to load trainer commission records: ${error.message}`);

    let eligibleSessions: unknown[] = [];
    if (isManager) {
      const { data: bookings, error: bookingError } = await supabase
        .from('class_bookings')
        .select('id, booking_date, class:classes!inner(id, gym_id, trainer_id, name), member:users!class_bookings_member_id_fkey(id, full_name)')
        .eq('status', 'attended')
        .eq('class.gym_id', gymId)
        .order('booking_date', { ascending: false })
        .limit(500);
      if (bookingError) throw new Error(`Commissions loaded, but attended sessions could not be loaded: ${bookingError.message}`);
      const commissionedBookings = new Set((commissions ?? []).map((item) => item.booking_id));
      eligibleSessions = (bookings ?? []).filter((booking) => !commissionedBookings.has(booking.id));
    }
    return NextResponse.json({ commissions: commissions ?? [], eligible_sessions: eligibleSessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load trainer commissions.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-origin commission changes are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to record commissions.' }, { status: 401 });
    const { gymId } = await params;
    if (!UUID_PATTERN.test(gymId)) return NextResponse.json({ error: 'A valid gym is required.' }, { status: 400 });
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can record trainer commissions.' }, { status: 403 });
    }
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.booking_id !== 'string' || !UUID_PATTERN.test(body.booking_id) ||
      typeof body.amount !== 'number' || !Number.isFinite(body.amount) ||
      body.amount <= 0 || body.amount > 1_000_000 || Math.round(body.amount * 100) !== body.amount * 100 ||
      (body.note !== undefined && body.note !== null &&
        (typeof body.note !== 'string' || body.note.trim().length > 500))) {
      return NextResponse.json({ error: 'Provide an attended booking, a valid ETB amount, and an optional note up to 500 characters.' }, { status: 400 });
    }
    const { data, error } = await getSupabaseAdmin().rpc('record_gym_commission', {
      p_gym_id: gymId,
      p_booking_id: body.booking_id,
      p_amount: body.amount,
      p_note: typeof body.note === 'string' ? body.note.trim() || null : null,
      p_actor_id: user.id,
    });
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'A commission is already recorded for this attended session.' }, { status: 409 });
      if (error.code === '22023') return NextResponse.json({ error: error.message }, { status: 400 });
      throw new Error(`Failed to record trainer commission: ${error.message}`);
    }
    return NextResponse.json({ commission_id: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record trainer commission.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-origin commission payouts are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to record commission payouts.' }, { status: 401 });
    const { gymId } = await params;
    if (!UUID_PATTERN.test(gymId)) return NextResponse.json({ error: 'A valid gym is required.' }, { status: 400 });
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can record payouts.' }, { status: 403 });
    }
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || !('commission_id' in body) ||
      typeof body.commission_id !== 'string' || !UUID_PATTERN.test(body.commission_id) ||
      !('status' in body) || body.status !== 'paid') {
      return NextResponse.json({ error: 'Provide a valid accrued commission to mark paid.' }, { status: 400 });
    }
    const { data, error } = await getSupabaseAdmin().rpc('mark_gym_commission_paid', {
      p_gym_id: gymId,
      p_commission_id: body.commission_id,
      p_actor_id: user.id,
    });
    if (error) throw new Error(`Failed to record commission payout: ${error.message}`);
    if (!data) return NextResponse.json({ error: 'Commission not found or already paid.' }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record commission payout.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
