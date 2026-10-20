import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

function isBookingDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin bookings are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to book a class.' }, { status: 401 });
    if (user.role !== 'member') return NextResponse.json({ error: 'Only members can book classes.' }, { status: 403 });

    const body: unknown = await request.json();
    const bookingDate = typeof body === 'object' && body !== null && 'booking_date' in body
      ? body.booking_date
      : null;
    if (!isBookingDate(bookingDate)) {
      return NextResponse.json({ error: 'Provide a valid class date in YYYY-MM-DD format.' }, { status: 400 });
    }

    const { classId } = await params;
    const { data, error } = await getSupabaseAdmin().rpc('book_class', {
      p_class_id: classId,
      p_member_id: user.id,
      p_booking_date: bookingDate,
    });
    if (error) {
      if (error.code === '42501') return NextResponse.json({ error: error.message }, { status: 403 });
      if (error.code === 'P0002') return NextResponse.json({ error: error.message }, { status: 404 });
      if (error.code === '22023') return NextResponse.json({ error: error.message }, { status: 409 });
      throw new Error(`Failed to book class: ${error.message}`);
    }

    const booking = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ success: true, booking });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to book class.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin booking changes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to cancel a class booking.' }, { status: 401 });
    if (user.role !== 'member') return NextResponse.json({ error: 'Only members can cancel class bookings.' }, { status: 403 });

    const bookingDate = request.nextUrl.searchParams.get('booking_date');
    if (!isBookingDate(bookingDate)) {
      return NextResponse.json({ error: 'Provide a valid class date in YYYY-MM-DD format.' }, { status: 400 });
    }

    const { classId } = await params;
    const { data: promotedBookingId, error } = await getSupabaseAdmin().rpc('cancel_class_booking', {
      p_class_id: classId,
      p_member_id: user.id,
      p_booking_date: bookingDate,
    });
    if (error) {
      if (error.code === 'P0002') return NextResponse.json({ error: error.message }, { status: 404 });
      throw new Error(`Failed to cancel class booking: ${error.message}`);
    }
    return NextResponse.json({ success: true, promoted_booking_id: promotedBookingId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel class booking.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin booking changes are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to reschedule a class.' }, { status: 401 });
    if (user.role !== 'member') return NextResponse.json({ error: 'Only members can reschedule bookings.' }, { status: 403 });
    const body: unknown = await request.json();
    if (
      typeof body !== 'object' || body === null ||
      !('old_booking_date' in body) || !isBookingDate(body.old_booking_date) ||
      !('new_booking_date' in body) || !isBookingDate(body.new_booking_date)
    ) {
      return NextResponse.json({ error: 'Provide valid old and new class dates.' }, { status: 400 });
    }
    const { classId } = await params;
    const { data, error } = await getSupabaseAdmin().rpc('reschedule_class_booking', {
      p_class_id: classId,
      p_member_id: user.id,
      p_old_date: body.old_booking_date,
      p_new_date: body.new_booking_date,
    });
    if (error) {
      const status = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : error.code === '23505' ? 409 : error.code === '22023' ? 400 : 500;
      if (status === 500) throw new Error(`Failed to reschedule class: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status });
    }
    const booking = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ success: true, booking });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reschedule class.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
