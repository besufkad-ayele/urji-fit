import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, canManageGym, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/gyms/[gymId]/members - Get all members for a gym
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to view gym memberships.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canManageGym(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to view this gym membership list.' }, { status: 403 });
    }
    const supabaseAdmin = getSupabaseAdmin();

    const { data: memberships, error } = await supabaseAdmin
      .from('gym_memberships')
      .select(`
        *,
        member:users!gym_memberships_member_id_fkey(
          id,
          full_name,
          email,
          phone,
          avatar_url,
          created_at
        )
      `)
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ memberships });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/gyms/[gymId]/members - Add new member to gym
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin membership changes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to manage gym memberships.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to manage this gym membership list.' }, { status: 403 });
    }
    const body: unknown = await req.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Membership data must be an object.' }, { status: 400 });
    }
    const {
      member_id,
      plan_id = null,
      membership_type,
      price,
      start_date,
      end_date,
      auto_renew = false,
    } = body as Record<string, unknown>;

    if (typeof member_id !== 'string') {
      return NextResponse.json(
        { error: 'An existing member account is required.' },
        { status: 400 }
      );
    }
    const validMembershipTypes = [
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
    ];
    if (plan_id === null && (typeof membership_type !== 'string' || !validMembershipTypes.includes(membership_type))) {
      return NextResponse.json({ error: 'Choose a valid membership type.' }, { status: 400 });
    }
    if (plan_id !== null && typeof plan_id !== 'string') {
      return NextResponse.json({ error: 'Choose a valid membership plan.' }, { status: 400 });
    }
    if (plan_id === null && (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 1_000_000)) {
      return NextResponse.json({ error: 'Membership price must be between ETB 0 and ETB 1,000,000.' }, { status: 400 });
    }
    if (auto_renew !== undefined && typeof auto_renew !== 'boolean') {
      return NextResponse.json({ error: 'Auto-renew must be true or false.' }, { status: 400 });
    }
    if (auto_renew) {
      return NextResponse.json({ error: 'Automated recurring billing is not available yet. Memberships are created without auto-renew.' }, { status: 400 });
    }
    const startDate = start_date ?? new Date().toISOString().slice(0, 10);
    if (
      typeof startDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      Number.isNaN(Date.parse(`${startDate}T00:00:00.000Z`)) ||
      new Date(`${startDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== startDate
    ) {
      return NextResponse.json({ error: 'Membership start date must use YYYY-MM-DD format.' }, { status: 400 });
    }
    if (
      end_date !== undefined &&
      end_date !== null &&
      (typeof end_date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(end_date) ||
        Number.isNaN(Date.parse(`${end_date}T00:00:00.000Z`)) ||
        new Date(`${end_date}T00:00:00.000Z`).toISOString().slice(0, 10) !== end_date)
    ) {
      return NextResponse.json({ error: 'Membership end date must use YYYY-MM-DD format.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: membershipId, error } = await supabaseAdmin.rpc('create_gym_membership', {
      p_gym_id: gymId,
      p_member_id: member_id,
      p_plan_id: plan_id,
      p_membership_type: typeof membership_type === 'string' ? membership_type : null,
      p_price: typeof price === 'number' ? price : null,
      p_start_date: startDate,
      p_end_date: typeof end_date === 'string' ? end_date : null,
      p_auto_renew: auto_renew,
      p_actor_id: user.id,
    });
    if (error) {
      const status = error.code === 'P0002' ? 404 : error.code === '23505' ? 409 : error.code === '22023' ? 400 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    const { data: membership, error: readError } = await supabaseAdmin
      .from('gym_memberships')
      .select(`
        *,
        member:users!gym_memberships_member_id_fkey(id, full_name, email, phone)
      `)
      .eq('id', membershipId)
      .single();
    if (readError) throw new Error(`Membership was created but could not be reloaded: ${readError.message}`);

    return NextResponse.json({ success: true, membership }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
