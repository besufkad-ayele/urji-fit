import { NextRequest, NextResponse } from 'next/server';
import { canManageGym, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

const RECEIPT_BUCKET = 'payment-receipts';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to view this receipt.' }, { status: 401 });

    const { paymentId } = await params;
    const supabaseAdmin = getSupabaseAdmin();
    const { data: payment, error } = await supabaseAdmin
      .from('payment_transactions')
      .select('id, gym_id, member_id, receipt_path')
      .eq('id', paymentId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load receipt: ${error.message}`);
    if (!payment || !payment.receipt_path) {
      return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 });
    }

    const isMemberReceipt = user.role === 'member' && payment.member_id === user.id;
    const isGymStaff = await canManageGym(user, payment.gym_id);
    if (!isMemberReceipt && !isGymStaff) {
      return NextResponse.json({ error: 'You are not authorized to view this receipt.' }, { status: 403 });
    }

    const { data, error: signedUrlError } = await supabaseAdmin.storage
      .from(RECEIPT_BUCKET)
      .createSignedUrl(payment.receipt_path, 60);
    if (signedUrlError) throw new Error(`Could not access the receipt image: ${signedUrlError.message}`);

    return NextResponse.redirect(data.signedUrl, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to open receipt.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
