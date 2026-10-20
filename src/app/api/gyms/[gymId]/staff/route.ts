import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, canManageGym, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { recordGymAuditEvent } from '@/lib/gym-audit';

const positions = ['trainer', 'head_trainer', 'receptionist', 'manager', 'maintenance'];

function isValidDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}

function validRate(value: unknown, maximum = 1_000_000): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum);
}

// GET /api/gyms/[gymId]/staff - Get all staff for a gym
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to view gym staff.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canManageGym(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to view this gym staff.' }, { status: 403 });
    }
    const supabaseAdmin = getSupabaseAdmin();

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
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin staff changes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to add gym staff.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to add staff to this gym.' }, { status: 403 });
    }
    const body: unknown = await req.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Staff details must be an object.' }, { status: 400 });
    }
    const {
      user_id,
      position,
      hire_date,
      hourly_rate,
      salary,
      commission_rate,
    } = body as Record<string, unknown>;

    if (typeof user_id !== 'string' || !user_id || typeof position !== 'string') {
      return NextResponse.json(
        { error: 'An existing user account and position are required.' },
        { status: 400 }
      );
    }
    if (!positions.includes(position)) {
      return NextResponse.json({ error: 'Choose a valid staff position.' }, { status: 400 });
    }
    if (hire_date !== undefined && !isValidDate(hire_date)) {
      return NextResponse.json({ error: 'Hire date must use YYYY-MM-DD format.' }, { status: 400 });
    }
    if (!validRate(hourly_rate) || !validRate(salary) || !validRate(commission_rate, 99.99)) {
      return NextResponse.json({ error: 'Rates must be non-negative; commission must not exceed 100%.' }, { status: 400 });
    }
    if (position === 'manager' && user.role !== 'gym_owner' && !['admin', 'platform_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only a gym owner or administrator can appoint a manager.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: account, error: accountError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', user_id)
      .maybeSingle();
    if (accountError) throw new Error(`Could not verify the staff account: ${accountError.message}`);
    if (!account || (['trainer', 'head_trainer'].includes(position) && account.role !== 'trainer')) {
      return NextResponse.json({ error: 'Choose an existing account with the correct role for this position.' }, { status: 400 });
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
      const status = error.code === '23505' ? 409 : 400;
      return NextResponse.json({ error: error.code === '23505' ? 'This account is already assigned to this gym.' : error.message }, { status });
    }

    await recordGymAuditEvent({
      gymId,
      actorId: user.id,
      action: 'staff_added',
      targetType: 'staff',
      targetId: staffMember.id,
      details: { user_id, position },
    });
    return NextResponse.json({ success: true, staff: staffMember });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/gyms/[gymId]/staff - Update staff member
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin staff changes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to update gym staff.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to update this gym staff.' }, { status: 403 });
    }
    const body: unknown = await req.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Staff changes must be an object.' }, { status: 400 });
    }
    const { staffId, ...updates } = body as Record<string, unknown>;

    if (typeof staffId !== 'string' || !staffId) {
      return NextResponse.json({ error: 'Staff ID is required.' }, { status: 400 });
    }
    const editableFields = ['position', 'hire_date', 'hourly_rate', 'salary', 'commission_rate', 'status', 'notes'] as const;
    const safeUpdates: Record<string, unknown> = {};
    for (const field of editableFields) {
      if (field in updates) safeUpdates[field] = updates[field];
    }
    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ error: 'No editable staff fields were provided.' }, { status: 400 });
    }
    if ('position' in safeUpdates && (typeof safeUpdates.position !== 'string' || !positions.includes(safeUpdates.position))) {
      return NextResponse.json({ error: 'Choose a valid staff position.' }, { status: 400 });
    }
    if ('hire_date' in safeUpdates && !isValidDate(safeUpdates.hire_date)) {
      return NextResponse.json({ error: 'Hire date must use YYYY-MM-DD format.' }, { status: 400 });
    }
    if (('hourly_rate' in safeUpdates && !validRate(safeUpdates.hourly_rate)) ||
        ('salary' in safeUpdates && !validRate(safeUpdates.salary)) ||
        ('commission_rate' in safeUpdates && !validRate(safeUpdates.commission_rate, 99.99))) {
      return NextResponse.json({ error: 'Rates must be non-negative; commission must not exceed 100%.' }, { status: 400 });
    }
    if ('status' in safeUpdates && !['active', 'on_leave', 'terminated'].includes(String(safeUpdates.status))) {
      return NextResponse.json({ error: 'Choose a valid staff status.' }, { status: 400 });
    }
    if ('notes' in safeUpdates && safeUpdates.notes !== null && (typeof safeUpdates.notes !== 'string' || safeUpdates.notes.length > 2000)) {
      return NextResponse.json({ error: 'Staff notes must be 2,000 characters or fewer.' }, { status: 400 });
    }
    if (safeUpdates.position === 'manager' && user.role !== 'gym_owner' && !['admin', 'platform_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Only a gym owner or administrator can appoint a manager.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: currentStaff, error: currentError } = await supabaseAdmin
      .from('gym_staff')
      .select('id, user_id, position')
      .eq('id', staffId)
      .eq('gym_id', gymId)
      .maybeSingle();
    if (currentError) throw new Error(`Could not verify the staff assignment: ${currentError.message}`);
    if (!currentStaff) return NextResponse.json({ error: 'Staff assignment not found.' }, { status: 404 });
    const nextPosition = safeUpdates.position;
    if ((nextPosition === 'trainer' || nextPosition === 'head_trainer') &&
        currentStaff.position !== 'trainer' && currentStaff.position !== 'head_trainer') {
      const { data: account, error: accountError } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', currentStaff.user_id)
        .maybeSingle();
      if (accountError) throw new Error(`Could not verify the trainer account: ${accountError.message}`);
      if (account?.role !== 'trainer') {
        return NextResponse.json({ error: 'Only a trainer account can be assigned as a trainer.' }, { status: 400 });
      }
    }
    const { data: staffMember, error } = await supabaseAdmin
      .from('gym_staff')
      .update({ ...safeUpdates, updated_at: new Date().toISOString() })
      .eq('id', staffId)
      .eq('gym_id', gymId)
      .select(`
        *,
        user:users!gym_staff_user_id_fkey(id, full_name, email, phone)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await recordGymAuditEvent({
      gymId,
      actorId: user.id,
      action: safeUpdates.status === 'terminated' ? 'staff_terminated' : 'staff_updated',
      targetType: 'staff',
      targetId: staffMember.id,
      details: { changed_fields: Object.keys(safeUpdates) },
    });
    return NextResponse.json({ success: true, staff: staffMember });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
