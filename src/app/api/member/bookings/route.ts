import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view class bookings.' }, { status: 401 });
    if (user.role !== 'member') return NextResponse.json({ error: 'Only members can view their class bookings.' }, { status: 403 });

    const { data: bookings, error } = await getSupabaseAdmin()
      .from('class_bookings')
      .select(`
        id,
        class_id,
        booking_date,
        status,
        created_at,
        class:classes!inner(
          name,
          start_time,
          duration_minutes,
          price,
          gym_id,
          gym:gyms!classes_gym_id_fkey(name)
        )
      `)
      .eq('member_id', user.id)
      .order('booking_date', { ascending: true })
      .limit(100);
    if (error) throw new Error(`Failed to load class bookings: ${error.message}`);
    return NextResponse.json({ bookings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load class bookings.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
