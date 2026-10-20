import { NextRequest, NextResponse } from 'next/server';
import { canManageGym, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PATCH(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin reminder changes are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to update invoice reminders.' }, { status: 401 });
    const body: unknown = await request.json();
    if (
      typeof body !== 'object' || body === null ||
      !('reminder_id' in body) || typeof body.reminder_id !== 'string' ||
      !('action' in body) || (body.action !== 'complete' && body.action !== 'dismiss')
    ) {
      return NextResponse.json({ error: 'Reminder ID and a valid action are required.' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data: reminder, error: lookupError } = await supabase
      .from('gym_invoice_reminders')
      .select('id, invoice:gym_invoices!inner(gym_id)')
      .eq('id', body.reminder_id)
      .maybeSingle();
    if (lookupError) throw new Error(`Failed to find invoice reminder: ${lookupError.message}`);
    if (!reminder) return NextResponse.json({ error: 'Reminder not found.' }, { status: 404 });
    const relatedInvoice = Array.isArray(reminder.invoice) ? reminder.invoice[0] : reminder.invoice;
    if (!relatedInvoice || !(await canManageGym(user, relatedInvoice.gym_id))) {
      return NextResponse.json({ error: 'You are not authorized to manage this reminder.' }, { status: 403 });
    }
    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('gym_invoice_reminders')
      .update({
        status: body.action === 'complete' ? 'completed' : 'dismissed',
        completed_by: user.id,
        completed_at: now,
      })
      .eq('id', body.reminder_id)
      .eq('status', 'open')
      .select('id, status, completed_at')
      .maybeSingle();
    if (error) throw new Error(`Failed to update invoice reminder: ${error.message}`);
    if (!updated) return NextResponse.json({ error: 'Reminder is already closed.' }, { status: 409 });
    return NextResponse.json({ success: true, reminder: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update invoice reminder.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
