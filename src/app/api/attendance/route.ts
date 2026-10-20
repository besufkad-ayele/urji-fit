import { NextRequest, NextResponse } from 'next/server';
import { canManageGym, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST /api/attendance - Check in/out
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin attendance changes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to manage attendance.' }, { status: 401 });
    const body = await req.json();
    const { gym_id, member_id, attendance_type, action = 'check_in' } = body;

    if (!gym_id || !member_id) {
      return NextResponse.json(
        { error: 'Gym ID and member ID are required' },
        { status: 400 }
      );
    }
    const isGymStaff = await canManageGym(user, gym_id);
    const isSelfCheckIn = user.role === 'member' && member_id === user.id;
    if (!isGymStaff && !isSelfCheckIn) {
      return NextResponse.json({ error: 'You are not authorized to change this attendance record.' }, { status: 403 });
    }
    if (!['check_in', 'check_out'].includes(action)) {
      return NextResponse.json({ error: 'Invalid attendance action.' }, { status: 400 });
    }
    if (!['open_gym', 'class', 'personal_training'].includes(attendance_type || 'open_gym')) {
      return NextResponse.json({ error: 'Invalid attendance type.' }, { status: 400 });
    }
    if (user.role === 'member' && (attendance_type || 'open_gym') !== 'open_gym') {
      return NextResponse.json({ error: 'Members can only self check in for open gym attendance.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (isSelfCheckIn && action === 'check_in') {
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from('gym_memberships')
        .select('id')
        .eq('gym_id', gym_id)
        .eq('member_id', user.id)
        .eq('status', 'active')
        .lte('start_date', new Date().toISOString().slice(0, 10))
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString().slice(0, 10)}`)
        .limit(1)
        .maybeSingle();
      if (membershipError) {
        return NextResponse.json({ error: `Could not verify gym access: ${membershipError.message}` }, { status: 500 });
      }
      if (!membership) {
        return NextResponse.json({ error: 'An active membership is required to check in.' }, { status: 403 });
      }
    }

    if (action === 'check_in') {
      // Create new attendance log
      const { data: attendance, error } = await supabaseAdmin
        .from('attendance_logs')
        .insert({
          gym_id,
          member_id,
          attendance_type: attendance_type || 'open_gym',
          check_in_at: new Date().toISOString(),
        })
        .select(`
          *,
          member:users!attendance_logs_member_id_fkey(id, full_name)
        `)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, attendance, message: 'Checked in successfully' });
    } else if (action === 'check_out') {
      // Find and update most recent check-in
      const { data: recentAttendance, error: fetchError } = await supabaseAdmin
        .from('attendance_logs')
        .select('*')
        .eq('gym_id', gym_id)
        .eq('member_id', member_id)
        .is('check_out_at', null)
        .order('check_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError || !recentAttendance) {
        return NextResponse.json(
          { error: 'No active check-in found for this member' },
          { status: 404 }
        );
      }

      const { data: attendance, error: updateError } = await supabaseAdmin
        .from('attendance_logs')
        .update({ check_out_at: new Date().toISOString() })
        .eq('id', recentAttendance.id)
        .select(`
          *,
          member:users!attendance_logs_member_id_fkey(id, full_name)
        `)
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, attendance, message: 'Checked out successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/attendance - Get attendance logs
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to view attendance.' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const gymId = searchParams.get('gymId');
    const requestedMemberId = searchParams.get('memberId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!gymId) {
      return NextResponse.json({ error: 'Gym ID is required' }, { status: 400 });
    }
    const isGymStaff = await canManageGym(user, gymId);
    if (user.role !== 'member' && !isGymStaff) {
      return NextResponse.json({ error: 'You are not authorized to view this gym attendance.' }, { status: 403 });
    }
    if (user.role === 'member' && requestedMemberId && requestedMemberId !== user.id) {
      return NextResponse.json({ error: 'Members can only view their own attendance.' }, { status: 403 });
    }
    if (user.role === 'member') {
      const { data: membership, error: membershipError } = await getSupabaseAdmin()
        .from('gym_memberships')
        .select('id')
        .eq('gym_id', gymId)
        .eq('member_id', user.id)
        .maybeSingle();
      if (membershipError) {
        return NextResponse.json({ error: `Could not verify gym access: ${membershipError.message}` }, { status: 500 });
      }
      if (!membership) return NextResponse.json({ error: 'You are not connected to this gym.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from('attendance_logs')
      .select(`
        *,
        member:users!attendance_logs_member_id_fkey(id, full_name, avatar_url)
      `)
      .eq('gym_id', gymId);

    if (user.role === 'member') {
      query = query.eq('member_id', user.id);
    } else if (requestedMemberId) {
      query = query.eq('member_id', requestedMemberId);
    }

    if (startDate) {
      query = query.gte('check_in_at', startDate);
    }

    if (endDate) {
      query = query.lte('check_in_at', endDate);
    }

    const { data: attendance, error } = await query.order('check_in_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ attendance });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
