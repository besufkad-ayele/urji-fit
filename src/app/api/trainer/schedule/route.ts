import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isSameOrigin(request: NextRequest): boolean {
  return request.headers.get('origin') === request.nextUrl.origin;
}

async function getTrainerGymIds(trainerId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('gym_staff')
    .select('gym_id')
    .eq('user_id', trainerId)
    .eq('status', 'active')
    .in('position', ['trainer', 'head_trainer']);
  if (error) throw new Error(`Failed to verify trainer gym access: ${error.message}`);
  return [...new Set((data ?? []).map((record) => record.gym_id))];
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'trainer') {
      return NextResponse.json({ error: 'A trainer session is required.' }, { status: 403 });
    }
    const gymIds = await getTrainerGymIds(user.id);
    if (!gymIds.length) return NextResponse.json({ classes: [], bookings: [], gyms: [] });
    const supabase = getSupabaseAdmin();
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('id, gym_id, name, description, class_type, day_of_week, start_time, duration_minutes, capacity, status')
      .eq('trainer_id', user.id)
      .in('gym_id', gymIds)
      .eq('status', 'active')
      .order('day_of_week')
      .order('start_time');
    if (classError) throw new Error(`Failed to load trainer classes: ${classError.message}`);
    const classIds = (classes ?? []).map((gymClass) => gymClass.id);
    const today = new Date().toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10);
    const [{ data: bookings, error: bookingError }, { data: gyms, error: gymError }] = await Promise.all([
      classIds.length
        ? supabase.from('class_bookings')
          .select('id, class_id, member_id, booking_date, status, checked_in_at, member:users!class_bookings_member_id_fkey(id, full_name, phone)')
          .in('class_id', classIds)
          .gte('booking_date', today)
          .lte('booking_date', endDate)
          .in('status', ['booked', 'waitlisted', 'attended', 'no_show'])
          .order('booking_date')
        : Promise.resolve({ data: [], error: null }),
      supabase.from('gyms').select('id, name').in('id', gymIds),
    ]);
    if (bookingError) throw new Error(`Class schedule loaded, but rosters could not be loaded: ${bookingError.message}`);
    if (gymError) throw new Error(`Class schedule loaded, but gym details could not be loaded: ${gymError.message}`);
    const gymById = new Map((gyms ?? []).map((gym) => [gym.id, gym]));
    return NextResponse.json({
      classes: (classes ?? []).map((gymClass) => ({ ...gymClass, gym: gymById.get(gymClass.gym_id) ?? null })),
      bookings: bookings ?? [],
      gyms: gyms ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load trainer schedule.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-origin class attendance changes are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'trainer') {
      return NextResponse.json({ error: 'A trainer session is required.' }, { status: 403 });
    }
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || !('booking_id' in body) ||
      !isUuid(body.booking_id) || !('status' in body) ||
      (body.status !== 'attended' && body.status !== 'no_show')) {
      return NextResponse.json({ error: 'Choose a valid class booking and attendance status.' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data: booking, error: bookingError } = await supabase
      .from('class_bookings')
      .select('id, class_id, booking_date, status, class:classes!class_bookings_class_id_fkey(id, gym_id, trainer_id, status)')
      .eq('id', body.booking_id)
      .maybeSingle();
    if (bookingError) throw new Error(`Failed to load class booking: ${bookingError.message}`);
    if (!booking) return NextResponse.json({ error: 'Class booking not found.' }, { status: 404 });
    const classInfo = Array.isArray(booking.class) ? booking.class[0] : booking.class;
    if (!classInfo || classInfo.trainer_id !== user.id || classInfo.status !== 'active') {
      return NextResponse.json({ error: 'You can only update attendance for your own active classes.' }, { status: 403 });
    }
    if (booking.booking_date > new Date().toISOString().slice(0, 10)) {
      return NextResponse.json({ error: 'Class attendance can only be recorded on or after the scheduled class date.' }, { status: 400 });
    }
    const gymIds = await getTrainerGymIds(user.id);
    if (!gymIds.includes(classInfo.gym_id)) {
      return NextResponse.json({ error: 'You are not authorized to manage attendance for this gym.' }, { status: 403 });
    }
    if (!['booked', 'attended', 'no_show'].includes(booking.status)) {
      return NextResponse.json({ error: 'Only booked class reservations can be marked attended or no-show.' }, { status: 409 });
    }
    const { data: updated, error: updateError } = await supabase
      .from('class_bookings')
      .update({
        status: body.status,
        checked_in_at: body.status === 'attended' ? new Date().toISOString() : null,
      })
      .eq('id', booking.id)
      .eq('status', 'booked')
      .select('id, class_id, member_id, booking_date, status, checked_in_at')
      .maybeSingle();
    if (updateError) throw new Error(`Failed to update class attendance: ${updateError.message}`);
    if (!updated) return NextResponse.json({ error: 'Booking attendance changed; refresh the roster and try again.' }, { status: 409 });
    return NextResponse.json({ success: true, booking: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update class attendance.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
