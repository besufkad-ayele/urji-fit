import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: 'Invoice reminder job is not configured.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const supabase = getSupabaseAdmin();
    const [{ data: remindersQueued, error: reminderError }, { data: renewalInvoicesQueued, error: renewalError }] = await Promise.all([
      supabase.rpc('queue_invoice_reminders'),
      supabase.rpc('queue_membership_renewal_invoices'),
    ]);
    if (reminderError) throw new Error(`Could not queue invoice reminders: ${reminderError.message}`);
    if (renewalError) throw new Error(`Could not queue membership renewal invoices: ${renewalError.message}`);
    return NextResponse.json({ success: true, reminders_queued: remindersQueued, renewal_invoices_queued: renewalInvoicesQueued });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not queue invoice reminders.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
