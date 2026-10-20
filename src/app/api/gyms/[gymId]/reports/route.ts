import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function dateRange(request: NextRequest) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultStart = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const fromParam = request.nextUrl.searchParams.get('from');
  const toParam = request.nextUrl.searchParams.get('to');
  const from = fromParam ? parseDate(fromParam) : defaultStart;
  const to = toParam ? parseDate(toParam) : today;
  if (!from || !to || from > to) return null;
  const duration = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (duration > 365) return null;
  return { from, to };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view gym reports.' }, { status: 401 });
    const { gymId } = await params;
    if (!UUID_PATTERN.test(gymId)) return NextResponse.json({ error: 'A valid gym is required.' }, { status: 400 });
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can view business reports.' }, { status: 403 });
    }
    const range = dateRange(request);
    if (!range) return NextResponse.json({ error: 'Choose a valid date range of 366 days or fewer.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const cutoff = new Date(now.getTime() - 14 * 86400000).toISOString();
    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select('id, name, trainer_id, day_of_week, capacity, trainer:users!classes_trainer_id_fkey(id, full_name)')
      .eq('gym_id', gymId)
      .eq('status', 'active')
      .limit(1000);
    if (classesError) throw new Error(`Could not load scheduled classes: ${classesError.message}`);
    const classIds = (classes ?? []).map((gymClass) => gymClass.id);
    const [
      { data: memberships, error: membershipError },
      { data: payments, error: paymentError },
      { data: sales, error: salesError },
      { data: invoices, error: invoiceError },
      { data: attendance, error: attendanceError },
      { data: activeMemberships, error: activeMembershipError },
      { data: recentVisits, error: recentVisitsError },
      { data: recentClassVisits, error: recentClassVisitsError },
      { data: membershipEvents, error: membershipEventError },
    ] = await Promise.all([
      supabase.from('gym_memberships')
        .select('id, status, created_at, updated_at')
        .eq('gym_id', gymId)
        .gte('created_at', `${range.from}T00:00:00.000Z`)
        .lte('created_at', `${range.to}T23:59:59.999Z`)
        .limit(10000),
      supabase.from('payment_transactions')
        .select('amount, currency, status, payment_date')
        .eq('gym_id', gymId)
        .eq('currency', 'ETB')
        .gte('payment_date', `${range.from}T00:00:00.000Z`)
        .lte('payment_date', `${range.to}T23:59:59.999Z`)
        .limit(10000),
      supabase.from('gym_pos_sales')
        .select('total, status, created_at')
        .eq('gym_id', gymId)
        .gte('created_at', `${range.from}T00:00:00.000Z`)
        .lte('created_at', `${range.to}T23:59:59.999Z`)
        .limit(10000),
      supabase.from('gym_invoices')
        .select('status, total, amount_paid, issued_at')
        .eq('gym_id', gymId)
        .limit(20000),
      supabase.from('attendance_logs')
        .select('id, member_id, check_in_at, class_booking_id')
        .eq('gym_id', gymId)
        .gte('check_in_at', `${range.from}T00:00:00.000Z`)
        .lte('check_in_at', `${range.to}T23:59:59.999Z`)
        .limit(20000),
      supabase.from('gym_memberships')
        .select('id, member_id, end_date, member:users!gym_memberships_member_id_fkey(id, full_name, email)')
        .eq('gym_id', gymId)
        .eq('status', 'active')
        .lte('start_date', today)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .limit(5000),
      supabase.from('attendance_logs')
        .select('member_id, check_in_at')
        .eq('gym_id', gymId)
        .gte('check_in_at', cutoff)
        .order('check_in_at', { ascending: false })
        .limit(20000),
      supabase.from('class_bookings')
        .select('member_id, booking_date, class:classes!inner(gym_id)')
        .eq('status', 'attended')
        .eq('class.gym_id', gymId)
        .gte('booking_date', cutoff.slice(0, 10))
        .order('booking_date', { ascending: false })
        .limit(20000),
      supabase.from('membership_audit_logs')
        .select('action')
        .eq('gym_id', gymId)
        .eq('action', 'cancel')
        .gte('created_at', `${range.from}T00:00:00.000Z`)
        .lte('created_at', `${range.to}T23:59:59.999Z`)
        .limit(10000),
    ]);
    const { data: bookings, error: bookingsError } = classIds.length
      ? await supabase.from('class_bookings')
        .select('id, class_id, booking_date, status, class:classes!class_bookings_class_id_fkey(id, name, trainer_id, capacity, trainer:users!classes_trainer_id_fkey(id, full_name))')
        .in('class_id', classIds)
        .gte('booking_date', range.from)
        .lte('booking_date', range.to)
        .limit(20000)
      : { data: [], error: null };
    const queryError = membershipError || paymentError || salesError || invoiceError || attendanceError ||
      bookingsError || activeMembershipError || recentVisitsError || recentClassVisitsError || membershipEventError;
    if (queryError) throw new Error(`Could not load complete gym report data: ${queryError.message}`);

    const activeMembers = activeMemberships ?? [];
    const visitedRecently = new Set([
      ...(recentVisits ?? []).map((visit) => visit.member_id),
      ...(recentClassVisits ?? []).map((visit) => visit.member_id),
    ]);
    const atRiskByMember = new Map<string, (typeof activeMembers)[number]>();
    for (const membership of activeMembers) {
      if (!visitedRecently.has(membership.member_id) && !atRiskByMember.has(membership.member_id)) {
        atRiskByMember.set(membership.member_id, membership);
      }
    }
    const atRisk = [...atRiskByMember.values()]
      .slice(0, 100)
      .map((membership) => {
        const member = Array.isArray(membership.member) ? membership.member[0] : membership.member;
        return {
          member_id: membership.member_id,
          full_name: member?.full_name ?? 'Member',
          email: member?.email ?? null,
          membership_end_date: membership.end_date,
        };
      });

    const revenueByDay = new Map<string, number>();
    let paymentRevenue = 0;
    let failedPayments = 0;
    for (const payment of payments ?? []) {
      if (payment.status === 'failed') failedPayments += 1;
      if (payment.status !== 'completed') continue;
      const amount = Number(payment.amount);
      paymentRevenue += amount;
      const day = payment.payment_date.slice(0, 10);
      revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + amount);
    }
    let posRevenue = 0;
    for (const sale of sales ?? []) {
      if (sale.status !== 'completed') continue;
      const amount = Number(sale.total);
      posRevenue += amount;
      const day = sale.created_at.slice(0, 10);
      revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + amount);
    }

    const classList = classes ?? [];
    const bookingRows = bookings ?? [];
    const bookingTotals = { booked: 0, attended: 0, no_show: 0, waitlisted: 0 };
    const trainerStats = new Map<string, { trainer_id: string; trainer_name: string; attended: number }>();
    for (const booking of bookingRows) {
      if (booking.status in bookingTotals) bookingTotals[booking.status as keyof typeof bookingTotals] += 1;
      if (booking.status !== 'attended') continue;
      const classRecord = Array.isArray(booking.class) ? booking.class[0] : booking.class;
      const trainer = classRecord?.trainer;
      if (!classRecord?.trainer_id) continue;
      const trainerUser = Array.isArray(trainer) ? trainer[0] : trainer;
      const current = trainerStats.get(classRecord.trainer_id) ?? {
        trainer_id: classRecord.trainer_id,
        trainer_name: trainerUser?.full_name ?? 'Trainer',
        attended: 0,
      };
      current.attended += 1;
      trainerStats.set(classRecord.trainer_id, current);
    }

    let scheduledCapacity = 0;
    const startDate = new Date(`${range.from}T00:00:00.000Z`);
    const endDate = new Date(`${range.to}T00:00:00.000Z`);
    for (const gymClass of classList) {
      const capacity = Number(gymClass.capacity ?? 0);
      if (capacity <= 0) continue;
      for (const date = new Date(startDate); date <= endDate; date.setUTCDate(date.getUTCDate() + 1)) {
        if (date.getUTCDay() === gymClass.day_of_week) scheduledCapacity += capacity;
      }
    }
    const attendedCount = bookingTotals.attended;
    const newMemberships = (memberships ?? []).filter((item) => item.created_at >= `${range.from}T00:00:00.000Z`).length;
    const canceledMemberships = membershipEvents?.length ?? 0;
    const activeCount = new Set(activeMembers.map((membership) => membership.member_id)).size;
    const upcomingRenewals = new Set(activeMembers
      .filter((membership) => membership.end_date !== null && membership.end_date <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
      .map((membership) => membership.member_id)).size;
    const invoiceRows = invoices ?? [];
    const invoicedAmount = invoiceRows.reduce((sum, invoice) => {
      const issuedAt = invoice.issued_at;
      return !['draft', 'void'].includes(invoice.status) &&
        issuedAt >= `${range.from}T00:00:00.000Z` && issuedAt <= `${range.to}T23:59:59.999Z`
        ? sum + Number(invoice.total) : sum;
    }, 0);
    const outstandingAmount = invoiceRows.reduce((sum, invoice) =>
      ['open', 'partially_paid', 'overdue'].includes(invoice.status)
        ? sum + Number(invoice.total) - Number(invoice.amount_paid)
        : sum, 0);
    const attendanceByDay = new Map<string, number>();
    for (const visit of attendance ?? []) {
      const day = visit.check_in_at.slice(0, 10);
      attendanceByDay.set(day, (attendanceByDay.get(day) ?? 0) + 1);
    }
    const loggedClassBookingIds = new Set((attendance ?? [])
      .map((visit) => visit.class_booking_id)
      .filter((bookingId): bookingId is string => Boolean(bookingId)));
    for (const booking of bookingRows) {
      if (booking.status !== 'attended' || loggedClassBookingIds.has(booking.id)) continue;
      attendanceByDay.set(booking.booking_date, (attendanceByDay.get(booking.booking_date) ?? 0) + 1);
    }
    const attendanceVisitCount = (attendance?.length ?? 0) + bookingRows.filter((booking) =>
      booking.status === 'attended' && !loggedClassBookingIds.has(booking.id)
    ).length;

    return NextResponse.json({
      range,
      summary: {
        active_members: activeCount,
        new_memberships: newMemberships,
        canceled_memberships: canceledMemberships,
        renewal_risk_members: upcomingRenewals,
        inactive_members_14_days: atRiskByMember.size,
        attendance_visits: attendanceVisitCount,
        completed_payments_etb: Number(paymentRevenue.toFixed(2)),
        pos_sales_etb: Number(posRevenue.toFixed(2)),
        total_cash_revenue_etb: Number((paymentRevenue + posRevenue).toFixed(2)),
        failed_payments: failedPayments,
        invoices_issued_etb: Number(invoicedAmount.toFixed(2)),
        outstanding_invoices_etb: Number(outstandingAmount.toFixed(2)),
        class_utilization_percent: scheduledCapacity > 0
          ? Number(((attendedCount / scheduledCapacity) * 100).toFixed(1))
          : 0,
      },
      revenue_by_day: [...revenueByDay.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, amount_etb]) => ({ date, amount_etb: Number(amount_etb.toFixed(2)) })),
      attendance_by_day: [...attendanceByDay.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, visits]) => ({ date, visits })),
      class_bookings: bookingTotals,
      trainer_performance: [...trainerStats.values()].sort((a, b) => b.attended - a.attended),
      at_risk_members: atRisk,
      limits: {
        max_report_days: 366,
        max_membership_rows: 10000,
        max_invoice_rows: 20000,
        max_payment_rows: 10000,
        max_pos_rows: 10000,
        max_booking_rows: 20000,
        max_active_members_checked_for_retention: 5000,
        max_attendance_rows: 20000,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load gym reports.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
