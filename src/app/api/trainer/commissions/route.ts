import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view trainer commissions.' }, { status: 401 });
    if (user.role !== 'trainer') {
      return NextResponse.json({ error: 'A trainer session is required.' }, { status: 403 });
    }
    const supabase = getSupabaseAdmin();
    const { data: staff, error: staffError } = await supabase
      .from('gym_staff')
      .select('gym_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .in('position', ['trainer', 'head_trainer']);
    if (staffError) throw new Error(`Failed to load trainer gym assignments: ${staffError.message}`);
    const gymIds = [...new Set((staff ?? []).map((record) => record.gym_id))];
    if (!gymIds.length) return NextResponse.json({ commissions: [] });
    const { data: commissions, error } = await supabase
      .from('gym_commissions')
      .select('id, gym_id, booking_id, amount, currency, status, note, created_at, paid_at, gym:gyms!gym_commissions_gym_id_fkey(name), booking:class_bookings!gym_commissions_booking_id_fkey(booking_date, class:classes!class_bookings_class_id_fkey(name), member:users!class_bookings_member_id_fkey(full_name))')
      .eq('trainer_id', user.id)
      .in('gym_id', gymIds)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw new Error(`Failed to load trainer commission records: ${error.message}`);
    return NextResponse.json({ commissions: commissions ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load trainer commissions.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
