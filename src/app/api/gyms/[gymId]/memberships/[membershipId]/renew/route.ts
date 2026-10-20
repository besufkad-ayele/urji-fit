import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string; membershipId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin membership renewals are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to create a renewal invoice.' }, { status: 401 });
    const { gymId, membershipId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can invoice renewals.' }, { status: 403 });
    }
    const body: unknown = await request.json();
    const dueDate = typeof body === 'object' && body !== null && 'due_date' in body && typeof body.due_date === 'string'
      ? body.due_date
      : new Date().toISOString().slice(0, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
      Number.isNaN(Date.parse(`${dueDate}T00:00:00.000Z`)) ||
      new Date(`${dueDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== dueDate ||
      dueDate < new Date().toISOString().slice(0, 10)
    ) {
      return NextResponse.json({ error: 'Due date must be today or a valid future date.' }, { status: 400 });
    }
    const { data: invoiceId, error } = await getSupabaseAdmin().rpc('create_membership_renewal_invoice', {
      p_gym_id: gymId,
      p_membership_id: membershipId,
      p_due_date: dueDate,
      p_actor_id: user.id,
    });
    if (error) {
      const status = error.code === 'P0002' ? 404 : error.code === '23505' ? 409 : error.code === '22023' ? 400 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ success: true, invoice_id: invoiceId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create renewal invoice.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
