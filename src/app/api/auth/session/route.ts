import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const deviceId = searchParams.get('deviceId');

  if (!userId || !deviceId) {
    return NextResponse.json({ active: false, error: 'Missing parameters' }, { status: 400 });
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json({ active: false, error: 'User not found' }, { status: 404 });
  }

  // Check single-device enforcement
  if (!user.current_device_id) {
    return NextResponse.json({
      active: false,
      reason: 'revoked',
      message: 'Active device lock has been revoked by the administrator. Please log in again to bind your device.',
    }, { status: 401 });
  }

  if (user.current_device_id !== deviceId) {
    return NextResponse.json({
      active: false,
      reason: 'superseded',
      message: 'Your account was logged in from another device. You have been logged out on this device.',
    }, { status: 401 });
  }


  // Update heartbeat
  await supabaseAdmin
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId);

  return NextResponse.json({ active: true, user });
}
