import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/analytics/gym-stats - Get gym statistics
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to view gym reports.' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const gymId = searchParams.get('gymId');

    if (!gymId) {
      return NextResponse.json({ error: 'Gym ID is required' }, { status: 400 });
    }
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to view this gym report.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    // Get total members
    const { count: totalMembers } = await supabaseAdmin
      .from('gym_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .eq('status', 'active');

    // Get total staff
    const { count: totalStaff } = await supabaseAdmin
      .from('gym_staff')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .eq('status', 'active');

    // Get active classes
    const { count: totalClasses } = await supabaseAdmin
      .from('classes')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .eq('status', 'active');

    // Get today's attendance
    const today = new Date().toISOString().split('T')[0];
    const { count: todayAttendance } = await supabaseAdmin
      .from('attendance_logs')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .gte('check_in_at', today + 'T00:00:00')
      .lte('check_in_at', today + 'T23:59:59');

    // Get monthly revenue
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthlyPayments } = await supabaseAdmin
      .from('payment_transactions')
      .select('amount')
      .eq('gym_id', gymId)
      .eq('status', 'completed')
      .gte('payment_date', startOfMonth.toISOString());

    const monthlyRevenue = monthlyPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    // Get weekly attendance trend (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: weeklyAttendance } = await supabaseAdmin
      .from('attendance_logs')
      .select('check_in_at')
      .eq('gym_id', gymId)
      .gte('check_in_at', sevenDaysAgo.toISOString())
      .order('check_in_at', { ascending: true });

    // Group by day
    const attendanceByDay = weeklyAttendance?.reduce((acc: Record<string, number>, log) => {
      const day = log.check_in_at.split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});

    // Get membership type breakdown
    const { data: membershipBreakdown } = await supabaseAdmin
      .from('gym_memberships')
      .select('membership_type')
      .eq('gym_id', gymId)
      .eq('status', 'active');

    const membershipTypes = membershipBreakdown?.reduce((acc: Record<string, number>, m) => {
      acc[m.membership_type] = (acc[m.membership_type] || 0) + 1;
      return acc;
    }, {});

    // Get expiring memberships (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const { count: expiringMemberships } = await supabaseAdmin
      .from('gym_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .eq('status', 'active')
      .lte('end_date', thirtyDaysFromNow.toISOString().split('T')[0]);

    return NextResponse.json({
      success: true,
      stats: {
        totalMembers: totalMembers || 0,
        totalStaff: totalStaff || 0,
        totalClasses: totalClasses || 0,
        todayAttendance: todayAttendance || 0,
        monthlyRevenue,
        attendanceByDay,
        membershipTypes,
        expiringMemberships: expiringMemberships || 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
