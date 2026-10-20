import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'member') {
      return NextResponse.json({ error: 'A member session is required.' }, { status: 403 });
    }
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: memberships, error: membershipError }, { data: bookings, error: bookingsError }] = await Promise.all([
      supabase
        .from('gym_memberships')
        .select('id, gym_id, membership_type, price, status, start_date, end_date, sessions_remaining, plan_id')
        .eq('member_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('class_bookings')
        .select('id, class_id, booking_date, status, checked_in_at, class:classes!class_bookings_class_id_fkey(id, gym_id, name, class_type, day_of_week, start_time, duration_minutes, trainer_id)')
        .eq('member_id', user.id)
        .gte('booking_date', today)
        .in('status', ['booked', 'waitlisted'])
        .order('booking_date', { ascending: true })
        .limit(100),
    ]);
    if (membershipError) throw new Error(`Failed to load memberships: ${membershipError.message}`);
    if (bookingsError) throw new Error(`Failed to load upcoming bookings: ${bookingsError.message}`);

    const gymIds = [...new Set((memberships ?? []).map((membership) => membership.gym_id))];
    const [{ data: gyms, error: gymError }, { data: attendance, error: attendanceError }] = await Promise.all([
      gymIds.length
        ? supabase.from('gyms').select('id, name, address, city').in('id', gymIds)
        : Promise.resolve({ data: [], error: null }),
      gymIds.length
        ? supabase.from('attendance_logs').select('id, gym_id, check_in_at, check_out_at, attendance_type')
          .eq('member_id', user.id).in('gym_id', gymIds)
          .order('check_in_at', { ascending: false }).limit(100)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (gymError) throw new Error(`Memberships loaded, but gym details could not be loaded: ${gymError.message}`);
    if (attendanceError) throw new Error(`Gym details loaded, but attendance history could not be loaded: ${attendanceError.message}`);
    const gymById = new Map((gyms ?? []).map((gym) => [gym.id, gym]));
    const membershipsWithAccess = (memberships ?? []).map((membership) => {
      const isActiveToday = membership.status === 'active' &&
        membership.start_date <= today &&
        (!membership.end_date || membership.end_date >= today);
      const remainingDays = membership.end_date
        ? Math.max(0, Math.ceil((Date.parse(`${membership.end_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000))
        : null;
      return { ...membership, is_active_today: isActiveToday, remaining_days: remainingDays };
    });
    return NextResponse.json({
      memberships: membershipsWithAccess,
      gyms: gyms ?? [],
      bookings: (bookings ?? []).map((booking) => {
        const classInfo = Array.isArray(booking.class) ? booking.class[0] : booking.class;
        return {
          ...booking,
          gym: classInfo ? gymById.get(classInfo.gym_id) ?? null : null,
        };
      }),
      attendance: (attendance ?? []).map((visit) => ({
        ...visit,
        gym: gymById.get(visit.gym_id) ?? null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load your gym overview.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
