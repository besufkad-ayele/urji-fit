import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { canManageGym, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const RECEIPT_BUCKET = 'payment-receipts';
const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
const RECEIPT_TYPES = {
  'image/jpeg': { extension: 'jpg', signature: (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/png': { extension: 'png', signature: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { extension: 'webp', signature: (bytes: Buffer) => bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' },
} as const;

function isSameOrigin(req: NextRequest): boolean {
  return req.headers.get('origin') === req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Sign in to view payment information.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const gymId = req.nextUrl.searchParams.get('gymId');

    if (user.role === 'member') {
      const [{ data: memberships, error: membershipError }, { data: gyms, error: gymError }, { data: payments, error: paymentError }, { data: invoices, error: invoiceError }] =
        await Promise.all([
          supabaseAdmin
            .from('gym_memberships')
            .select('id, gym_id, membership_type, price, status, start_date, end_date, sessions_remaining')
            .eq('member_id', user.id)
            .order('created_at', { ascending: false }),
          supabaseAdmin
            .from('gyms')
            .select('id, name, bank_name, bank_account_name, bank_account_number, mobile_money_provider, mobile_money_account, payment_instructions')
            .eq('status', 'active')
            .order('name'),
          supabaseAdmin
            .from('payment_transactions')
            .select('id, gym_id, membership_id, amount, currency, payment_method, transaction_type, status, payment_date, reference_number, receipt_path, reviewed_at, rejection_reason, created_at')
            .eq('member_id', user.id)
            .order('created_at', { ascending: false }),
          supabaseAdmin
            .from('gym_invoices')
            .select('id, gym_id, invoice_number, membership_id, source, status, subtotal, discount_amount, total, amount_paid, due_date, period_start, period_end, notes, issued_at, lines:gym_invoice_lines(id, membership_id, period_start, period_end, description, quantity, unit_price, line_total)')
            .eq('member_id', user.id)
            .order('due_date', { ascending: true }),
        ]);

      const error = membershipError || gymError || paymentError || invoiceError;
      if (error) throw new Error(`Failed to load payment information: ${error.message}`);
      const paymentHistory = (payments ?? []).map(({ receipt_path, ...payment }) => ({
        ...payment,
        has_receipt: Boolean(receipt_path),
      }));
      return NextResponse.json({ memberships: memberships ?? [], gyms: gyms ?? [], payments: paymentHistory, invoices: invoices ?? [] });
    }

    if (!gymId) {
      let gymsQuery = supabaseAdmin
        .from('gyms')
        .select('id, name')
        .eq('status', 'active')
        .order('name');

      if (user.role === 'gym_owner') {
        gymsQuery = gymsQuery.eq('owner_id', user.id);
      } else if (user.role !== 'admin' && user.role !== 'platform_admin') {
        const { data: staffRecords, error: staffError } = await supabaseAdmin
          .from('gym_staff')
          .select('gym_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .in('position', ['manager', 'receptionist']);
        if (staffError) throw new Error(`Failed to load staff gyms: ${staffError.message}`);
        const gymIds = (staffRecords ?? []).map((staff) => staff.gym_id);
        if (gymIds.length === 0) return NextResponse.json({ gyms: [], payments: [] });
        gymsQuery = gymsQuery.in('id', gymIds);
      }

      const { data: gyms, error } = await gymsQuery;
      if (error) throw new Error(`Failed to load gyms: ${error.message}`);
      return NextResponse.json({ gyms: gyms ?? [], payments: [] });
    }

    if (!(await canManageGym(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to manage payments for this gym.' }, { status: 403 });
    }

    const { data: payments, error } = await supabaseAdmin
      .from('payment_transactions')
      .select('id, gym_id, member_id, membership_id, amount, currency, payment_method, transaction_type, status, payment_date, reference_number, receipt_path, reviewed_by, reviewed_at, rejection_reason, created_at, member:users!payment_transactions_member_id_fkey(id, full_name, email, phone)')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(`Failed to load gym payments: ${error.message}`);
    const { data: invoices, error: invoiceError } = await supabaseAdmin
      .from('gym_invoices')
      .select('id, gym_id, invoice_number, member_id, membership_id, source, status, subtotal, discount_amount, total, amount_paid, due_date, notes, issued_at')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false })
      .limit(250);
    if (invoiceError) throw new Error(`Payments loaded, but invoices could not be loaded: ${invoiceError.message}`);
    const reviewedPayments = (payments ?? []).map(({ receipt_path, ...payment }) => ({
      ...payment,
      has_receipt: Boolean(receipt_path),
    }));
    return NextResponse.json({ payments: reviewedPayments, invoices: invoices ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load payments.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Cross-origin payment submissions are not allowed.' }, { status: 403 });
  }

  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_RECEIPT_SIZE + 64 * 1024) {
    return NextResponse.json({ error: 'Receipt files must be 5 MB or smaller.' }, { status: 413 });
  }

  let receiptPath: string | null = null;
  try {
    const user = await getAuthenticatedUser(req);
    if (!user || user.role !== 'member') {
      return NextResponse.json({ error: 'A signed-in member account is required.' }, { status: 401 });
    }

    const formData = await req.formData();
    const gymId = formData.get('gymId');
    const membershipId = formData.get('membershipId');
    const invoiceIdValue = formData.get('invoiceId');
    const amountValue = formData.get('amount');
    const method = formData.get('paymentMethod');
    const referenceValue = formData.get('referenceNumber');
    const receipt = formData.get('receipt');

    if (
      typeof gymId !== 'string' ||
      typeof amountValue !== 'string' ||
      (method !== 'bank_transfer' && method !== 'mobile_money') ||
      !(receipt instanceof File)
    ) {
      return NextResponse.json(
        { error: 'Gym, amount, payment method, and a receipt image are required.' },
        { status: 400 }
      );
    }

    const amount = Number(amountValue);
    if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000 || Math.round(amount * 100) !== amount * 100) {
      return NextResponse.json({ error: 'Enter a valid amount between ETB 1 and ETB 1,000,000.' }, { status: 400 });
    }
    if (receipt.size < 1 || receipt.size > MAX_RECEIPT_SIZE) {
      return NextResponse.json({ error: 'Receipt files must be between 1 byte and 5 MB.' }, { status: 400 });
    }
    const receiptType = RECEIPT_TYPES[receipt.type as keyof typeof RECEIPT_TYPES];
    if (!receiptType) {
      return NextResponse.json({ error: 'Upload a JPG, PNG, or WebP screenshot.' }, { status: 400 });
    }

    const referenceNumber = typeof referenceValue === 'string' ? referenceValue.trim() : '';
    if (referenceNumber.length > 100) {
      return NextResponse.json({ error: 'The payment reference must be 100 characters or fewer.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: gym, error: gymError } = await supabaseAdmin
      .from('gyms')
      .select('id, bank_account_number, mobile_money_provider, mobile_money_account')
      .eq('id', gymId)
      .eq('status', 'active')
      .maybeSingle();
    if (gymError) throw new Error(`Failed to verify gym: ${gymError.message}`);
    if (!gym) return NextResponse.json({ error: 'That gym is not available for payment.' }, { status: 404 });
    if (
      (method === 'bank_transfer' && !gym.bank_account_number) ||
      (method === 'mobile_money' && (!gym.mobile_money_provider || !gym.mobile_money_account))
    ) {
      return NextResponse.json({ error: 'The gym has not configured this payment method yet.' }, { status: 400 });
    }

    let selectedMembershipId: string | null = null;
    let selectedInvoiceId: string | null = null;
    if (typeof invoiceIdValue === 'string' && invoiceIdValue) {
      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from('gym_invoices')
        .select('id, gym_id, member_id, membership_id, total, amount_paid, status')
        .eq('id', invoiceIdValue)
        .eq('gym_id', gymId)
        .eq('member_id', user.id)
        .maybeSingle();
      if (invoiceError) throw new Error(`Failed to verify invoice: ${invoiceError.message}`);
      if (!invoice || !['open', 'partially_paid', 'overdue'].includes(invoice.status)) {
        return NextResponse.json({ error: 'Choose an unpaid invoice belonging to your account.' }, { status: 400 });
      }
      const outstanding = Number(invoice.total) - Number(invoice.amount_paid);
      if (amount > outstanding) {
        return NextResponse.json({ error: 'Payment amount cannot exceed the invoice balance.' }, { status: 400 });
      }
      selectedInvoiceId = invoice.id;
      selectedMembershipId = invoice.membership_id;
    } else if (typeof membershipId === 'string' && membershipId) {
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from('gym_memberships')
        .select('id, price, status')
        .eq('id', membershipId)
        .eq('gym_id', gymId)
        .eq('member_id', user.id)
        .maybeSingle();
      if (membershipError) throw new Error(`Failed to verify membership: ${membershipError.message}`);
      if (!membership || !['active', 'suspended'].includes(membership.status)) {
        return NextResponse.json({ error: 'Select a valid membership belonging to you at this gym.' }, { status: 400 });
      }
      if (Number(membership.price) !== amount) {
        return NextResponse.json({ error: 'The submitted amount must match the selected membership price.' }, { status: 400 });
      }
      selectedMembershipId = membership.id;
    }

    if (referenceNumber) {
      const { data: duplicate, error: duplicateError } = await supabaseAdmin
        .from('payment_transactions')
        .select('id')
        .eq('gym_id', gymId)
        .eq('reference_number', referenceNumber)
        .maybeSingle();
      if (duplicateError) throw new Error(`Failed to verify payment reference: ${duplicateError.message}`);
      if (duplicate) {
        return NextResponse.json({ error: 'This payment reference has already been submitted.' }, { status: 409 });
      }
    }

    const image = Buffer.from(await receipt.arrayBuffer());
    if (!RECEIPT_TYPES[receipt.type as keyof typeof RECEIPT_TYPES].signature(image)) {
      return NextResponse.json({ error: 'The uploaded file does not match its image type.' }, { status: 400 });
    }

    receiptPath = `${user.id}/${randomUUID()}.${receiptType.extension}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(RECEIPT_BUCKET)
      .upload(receiptPath, image, { contentType: receipt.type, upsert: false });
    if (uploadError) throw new Error(`Could not store the receipt image: ${uploadError.message}`);

    const { data: payment, error: insertError } = await supabaseAdmin
      .from('payment_transactions')
      .insert({
        gym_id: gymId,
        member_id: user.id,
        membership_id: selectedMembershipId,
        invoice_id: selectedInvoiceId,
        amount,
        currency: 'ETB',
        payment_method: method,
        transaction_type: 'membership_fee',
        status: 'pending',
        reference_number: referenceNumber || null,
        receipt_path: receiptPath,
        payment_date: new Date().toISOString(),
      })
      .select('id, gym_id, membership_id, amount, currency, payment_method, transaction_type, status, payment_date, reference_number, created_at')
      .single();

    if (insertError) {
      const { error: cleanupError } = await supabaseAdmin.storage
        .from(RECEIPT_BUCKET)
        .remove([receiptPath]);
      if (cleanupError) {
        throw new Error(
          `Could not save the payment (${insertError.message}) or remove its uploaded receipt (${cleanupError.message}).`
        );
      }
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'This payment reference has already been submitted.' }, { status: 409 });
      }
      throw new Error(`Could not save the payment submission: ${insertError.message}`);
    }

    return NextResponse.json({ success: true, payment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit payment.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
