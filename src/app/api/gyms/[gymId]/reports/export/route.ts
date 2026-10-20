import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

const DATASETS = ['payments', 'invoices', 'members', 'attendance', 'trainer-performance', 'commissions', 'inventory', 'pos'] as const;
type Dataset = (typeof DATASETS)[number];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function csvResponse(dataset: Dataset, columns: string[], rows: unknown[][], gymId: string) {
  const content = [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  return new NextResponse(`\uFEFF${content}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="urji-fit-${dataset}-${gymId}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

function dateBounds(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');
  const validDate = (value: string | null) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if ((from && !validDate(from)) || (to && !validDate(to))) return null;
  const start = from ?? new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const end = to ?? new Date().toISOString().slice(0, 10);
  if (start > end || (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 > 365) return null;
  return { start, end };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to export gym data.' }, { status: 401 });
    const { gymId } = await params;
    if (!UUID_PATTERN.test(gymId)) return NextResponse.json({ error: 'A valid gym is required.' }, { status: 400 });
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can export gym reports.' }, { status: 403 });
    }
    const datasetParam = request.nextUrl.searchParams.get('dataset');
    const dataset = DATASETS.find((candidate) => candidate === datasetParam);
    if (!dataset) {
      return NextResponse.json({ error: `Choose one of these datasets: ${DATASETS.join(', ')}.` }, { status: 400 });
    }
    const range = dateBounds(request);
    if (!range) return NextResponse.json({ error: 'Choose a valid date range of 366 days or fewer.' }, { status: 400 });
    const supabase = getSupabaseAdmin();

    if (dataset === 'payments') {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('id, member_id, amount, currency, payment_method, transaction_type, status, payment_date, reference_number, member:users!payment_transactions_member_id_fkey(full_name, email)')
        .eq('gym_id', gymId).gte('payment_date', `${range.start}T00:00:00.000Z`).lte('payment_date', `${range.end}T23:59:59.999Z`)
        .order('payment_date', { ascending: false }).limit(10000);
      if (error) throw new Error(`Failed to export payments: ${error.message}`);
      const rows = (data ?? []).map((item) => {
        const member = Array.isArray(item.member) ? item.member[0] : item.member;
        return [item.id, member?.full_name, member?.email, item.amount, item.currency, item.payment_method, item.transaction_type, item.status, item.payment_date, item.reference_number];
      });
      return csvResponse(dataset, ['payment_id', 'member_name', 'member_email', 'amount', 'currency', 'method', 'type', 'status', 'paid_at', 'reference'], rows, gymId);
    }

    if (dataset === 'invoices') {
      const { data, error } = await supabase
        .from('gym_invoices')
        .select('id, invoice_number, member_id, source, status, subtotal, discount_amount, total, amount_paid, due_date, issued_at, member:users!gym_invoices_member_id_fkey(full_name, email)')
        .eq('gym_id', gymId).gte('issued_at', `${range.start}T00:00:00.000Z`).lte('issued_at', `${range.end}T23:59:59.999Z`)
        .order('issued_at', { ascending: false }).limit(10000);
      if (error) throw new Error(`Failed to export invoices: ${error.message}`);
      const rows = (data ?? []).map((item) => {
        const member = Array.isArray(item.member) ? item.member[0] : item.member;
        return [item.id, item.invoice_number, item.member_id, member?.full_name, member?.email, item.source, item.status, item.subtotal, item.discount_amount, item.total, item.amount_paid, item.due_date, item.issued_at];
      });
      return csvResponse(dataset, ['invoice_id', 'invoice_number', 'member_id', 'member_name', 'member_email', 'source', 'status', 'subtotal_etb', 'discount_etb', 'total_etb', 'amount_paid_etb', 'due_date', 'issued_at'], rows, gymId);
    }

    if (dataset === 'members') {
      const { data, error } = await supabase
        .from('gym_memberships')
        .select('id, member_id, membership_type, status, price, start_date, end_date, sessions_remaining, member:users!gym_memberships_member_id_fkey(full_name, email, phone)')
        .eq('gym_id', gymId).gte('created_at', `${range.start}T00:00:00.000Z`).lte('created_at', `${range.end}T23:59:59.999Z`)
        .order('created_at', { ascending: false }).limit(10000);
      if (error) throw new Error(`Failed to export memberships: ${error.message}`);
      const rows = (data ?? []).map((item) => {
        const member = Array.isArray(item.member) ? item.member[0] : item.member;
        return [item.id, item.member_id, member?.full_name, member?.email, member?.phone, item.membership_type, item.status, item.price, item.start_date, item.end_date, item.sessions_remaining];
      });
      return csvResponse(dataset, ['membership_id', 'member_id', 'member_name', 'email', 'phone', 'plan', 'status', 'price_etb', 'start_date', 'end_date', 'sessions_remaining'], rows, gymId);
    }

    if (dataset === 'attendance') {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('id, member_id, check_in_at, check_out_at, attendance_type, class_booking_id, member:users!attendance_logs_member_id_fkey(full_name, email)')
        .eq('gym_id', gymId).gte('check_in_at', `${range.start}T00:00:00.000Z`).lte('check_in_at', `${range.end}T23:59:59.999Z`)
        .order('check_in_at', { ascending: false }).limit(20000);
      if (error) throw new Error(`Failed to export attendance: ${error.message}`);
      const rows = (data ?? []).map((item) => {
        const member = Array.isArray(item.member) ? item.member[0] : item.member;
        return [item.id, item.member_id, member?.full_name, member?.email, item.attendance_type, item.check_in_at, item.check_out_at, item.class_booking_id];
      });
      return csvResponse(dataset, ['attendance_id', 'member_id', 'member_name', 'member_email', 'type', 'check_in', 'check_out', 'class_booking_id'], rows, gymId);
    }

    if (dataset === 'trainer-performance') {
      const { data, error } = await supabase
        .from('class_bookings')
        .select('id, booking_date, member:users!class_bookings_member_id_fkey(full_name), class:classes!inner(name, gym_id, trainer:users!classes_trainer_id_fkey(full_name))')
        .eq('status', 'attended').eq('class.gym_id', gymId)
        .gte('booking_date', range.start).lte('booking_date', range.end)
        .order('booking_date', { ascending: false }).limit(20000);
      if (error) throw new Error(`Failed to export trainer attendance: ${error.message}`);
      const rows = (data ?? []).map((item) => {
        const member = Array.isArray(item.member) ? item.member[0] : item.member;
        const classRecord = Array.isArray(item.class) ? item.class[0] : item.class;
        const trainer = Array.isArray(classRecord?.trainer) ? classRecord.trainer[0] : classRecord?.trainer;
        return [item.id, item.booking_date, trainer?.full_name, classRecord?.name, member?.full_name];
      });
      return csvResponse(dataset, ['booking_id', 'session_date', 'trainer_name', 'class_name', 'member_name'], rows, gymId);
    }

    if (dataset === 'commissions') {
      const { data, error } = await supabase
        .from('gym_commissions')
        .select('id, trainer_id, booking_id, amount, currency, status, note, created_at, paid_at, trainer:users!gym_commissions_trainer_id_fkey(full_name)')
        .eq('gym_id', gymId).gte('created_at', `${range.start}T00:00:00.000Z`).lte('created_at', `${range.end}T23:59:59.999Z`)
        .order('created_at', { ascending: false }).limit(10000);
      if (error) throw new Error(`Failed to export commissions: ${error.message}`);
      const rows = (data ?? []).map((item) => {
        const trainer = Array.isArray(item.trainer) ? item.trainer[0] : item.trainer;
        return [item.id, item.trainer_id, trainer?.full_name, item.booking_id, item.amount, item.currency, item.status, item.note, item.created_at, item.paid_at];
      });
      return csvResponse(dataset, ['commission_id', 'trainer_id', 'trainer_name', 'booking_id', 'amount', 'currency', 'status', 'note', 'recorded_at', 'paid_at'], rows, gymId);
    }

    if (dataset === 'inventory') {
      const { data, error } = await supabase
        .from('gym_products')
        .select('id, sku, name, description, price, cost, stock_quantity, low_stock_threshold, is_active, updated_at')
        .eq('gym_id', gymId).order('name').limit(10000);
      if (error) throw new Error(`Failed to export inventory: ${error.message}`);
      const rows = (data ?? []).map((item) => [item.id, item.sku, item.name, item.description, item.price, item.cost, item.stock_quantity, item.low_stock_threshold, item.is_active, item.updated_at]);
      return csvResponse(dataset, ['product_id', 'sku', 'name', 'description', 'price_etb', 'cost_etb', 'stock_quantity', 'low_stock_threshold', 'active', 'updated_at'], rows, gymId);
    }

    const { data, error } = await supabase
      .from('gym_pos_sales')
      .select('id, member_id, cashier_id, status, payment_method, subtotal, total, created_at')
      .eq('gym_id', gymId).gte('created_at', `${range.start}T00:00:00.000Z`).lte('created_at', `${range.end}T23:59:59.999Z`)
      .order('created_at', { ascending: false }).limit(10000);
    if (error) throw new Error(`Failed to export POS sales: ${error.message}`);
    const rows = (data ?? []).map((item) => [item.id, item.member_id, item.cashier_id, item.status, item.payment_method, item.subtotal, item.total, item.created_at]);
    return csvResponse(dataset, ['sale_id', 'member_id', 'cashier_id', 'status', 'payment_method', 'subtotal_etb', 'total_etb', 'created_at'], rows, gymId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export gym data.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
