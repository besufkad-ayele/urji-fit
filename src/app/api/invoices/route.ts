import { NextRequest, NextResponse } from 'next/server';
import { canManageGym, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view invoices.' }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const gymId = request.nextUrl.searchParams.get('gymId');
    let query = supabase
      .from('gym_invoices')
      .select(`
        id, gym_id, invoice_number, member_id, household_id, membership_id, source,
        status, subtotal, discount_amount, total, amount_paid, due_date,
        period_start, period_end, notes, issued_at, created_at,
        member:users!gym_invoices_member_id_fkey(id, full_name, email, phone),
        lines:gym_invoice_lines(id, member_id, membership_id, product_id, period_start, period_end, description, quantity, unit_price, line_total),
        reminders:gym_invoice_reminders(id, reminder_type, status, due_at, completed_at)
      `)
      .order('due_date', { ascending: true })
      .limit(250);

    if (user.role === 'member') {
      if (gymId) query = query.eq('gym_id', gymId);
      query = query.eq('member_id', user.id);
    } else {
      if (!gymId) return NextResponse.json({ error: 'Choose a gym to view invoices.' }, { status: 400 });
      if (!(await canManageGym(user, gymId))) {
        return NextResponse.json({ error: 'You are not authorized to view invoices for this gym.' }, { status: 403 });
      }
      query = query.eq('gym_id', gymId);
    }

    const { data: invoices, error } = await query;
    if (error) throw new Error(`Failed to load invoices: ${error.message}`);
    return NextResponse.json({ invoices });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load invoices.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin invoice changes are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to create an invoice.' }, { status: 401 });
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.gym_id !== 'string' ||
      typeof body.description !== 'string' || typeof body.due_date !== 'string') {
      return NextResponse.json({ error: 'Gym, description, and due date are required.' }, { status: 400 });
    }
    if (!(await canManageGym(user, body.gym_id))) {
      return NextResponse.json({ error: 'You are not authorized to create invoices for this gym.' }, { status: 403 });
    }
    if (body.description.trim().length < 1 || body.description.trim().length > 200) {
      return NextResponse.json({ error: 'Description must be 1 to 200 characters.' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.due_date) ||
      Number.isNaN(Date.parse(`${body.due_date}T00:00:00.000Z`)) ||
      new Date(`${body.due_date}T00:00:00.000Z`).toISOString().slice(0, 10) !== body.due_date) {
      return NextResponse.json({ error: 'Due date must be a valid YYYY-MM-DD date.' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    let invoiceId: string | null = null;
    let error: { code?: string; message: string } | null = null;
    if ('household_id' in body && typeof body.household_id === 'string') {
      const result = await supabase.rpc('create_household_gym_invoice', {
        p_gym_id: body.gym_id,
        p_household_id: body.household_id,
        p_description: body.description.trim(),
        p_due_date: body.due_date,
        p_actor_id: user.id,
      });
      invoiceId = result.data;
      error = result.error;
    } else if ('member_id' in body && typeof body.member_id === 'string' && 'amount' in body && typeof body.amount === 'number') {
      if ('promo_code' in body && body.promo_code !== null && (typeof body.promo_code !== 'string' || body.promo_code.length > 40)) {
        return NextResponse.json({ error: 'Promo code must be 40 characters or fewer.' }, { status: 400 });
      }
      const result = await supabase.rpc('create_manual_gym_invoice', {
        p_gym_id: body.gym_id,
        p_member_id: body.member_id,
        p_description: body.description.trim(),
        p_amount: body.amount,
        p_due_date: body.due_date,
        p_actor_id: user.id,
        p_promo_code: typeof body.promo_code === 'string' ? body.promo_code.trim() || null : null,
      });
      invoiceId = result.data;
      error = result.error;
    } else {
      return NextResponse.json({ error: 'Choose a member and amount, or choose a household with unpaid membership invoices.' }, { status: 400 });
    }
    if (error) {
      const status = error.code === 'P0002' ? 404 : error.code === '22023' ? 400 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ success: true, invoice_id: invoiceId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create invoice.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
