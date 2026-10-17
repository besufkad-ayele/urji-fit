import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST /api/attendance - Check in/out
export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();
    const { gym_id, member_id, attendance_type, action = 'check_in' } = body;

    if (!gym_id || !member_id) {
      return NextResponse.json(
        { error: 'Gym ID and member ID are required' },
        { status: 400 }
      );
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
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const gymId = searchParams.get('gymId');
    const memberId = searchParams.get('memberId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!gymId) {
      return NextResponse.json({ error: 'Gym ID is required' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('attendance_logs')
      .select(`
        *,
        member:users!attendance_logs_member_id_fkey(id, full_name, avatar_url)
      `)
      .eq('gym_id', gymId);

    if (memberId) {
      query = query.eq('member_id', memberId);
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
