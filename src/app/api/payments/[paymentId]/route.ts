import { NextRequest, NextResponse } from 'next/server';
import { canManageGym, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin payment reviews are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to review payments.' }, { status: 401 });

    const { paymentId } = await params;
    const body: unknown = await req.json();
    if (typeof body !== 'object' || body === null || !('action' in body)) {
      return NextResponse.json({ error: 'A review action is required.' }, { status: 400 });
    }
    const action = body.action;
    const reason = 'reason' in body && typeof body.reason === 'string' ? body.reason.trim() : '';
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Choose approve or reject.' }, { status: 400 });
    }
    if (action === 'reject' && (reason.length < 3 || reason.length > 500)) {
      return NextResponse.json({ error: 'Provide a rejection reason between 3 and 500 characters.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('payment_transactions')
      .select('id, gym_id, status')
      .eq('id', paymentId)
      .maybeSingle();
    if (lookupError) throw new Error(`Failed to load payment: ${lookupError.message}`);
    if (!existing) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    if (!(await canManageGym(user, existing.gym_id))) {
      return NextResponse.json({ error: 'You are not authorized to review this gym payment.' }, { status: 403 });
    }
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: 'This payment has already been reviewed.' }, { status: 409 });
    }

    const { data: payment, error: updateError } = await supabaseAdmin
      .from('payment_transactions')
      .update({
        status: action === 'approve' ? 'completed' : 'failed',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: action === 'reject' ? reason : null,
      })
      .eq('id', paymentId)
      .eq('status', 'pending')
      .select('id, status, reviewed_by, reviewed_at, rejection_reason')
      .maybeSingle();

    if (updateError) throw new Error(`Failed to update payment review: ${updateError.message}`);
    if (!payment) return NextResponse.json({ error: 'This payment has already been reviewed.' }, { status: 409 });
    return NextResponse.json({ success: true, payment });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to review payment.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
