import { randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin OTP requests are not allowed.' }, { status: 403 });
  }

  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin || !['admin', 'platform_admin'].includes(admin.role)) {
      return NextResponse.json({ error: 'An administrator session is required.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (targetUserError) {
      return NextResponse.json({ error: `Could not verify target account: ${targetUserError.message}` }, { status: 500 });
    }
    if (!targetUser) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    if (
      ['admin', 'platform_admin'].includes(targetUser.role) &&
      admin.role !== 'platform_admin'
    ) {
      return NextResponse.json(
        { error: 'Only a platform administrator can issue codes for administrator accounts.' },
        { status: 403 }
      );
    }

    // Invalidate every previous unconsumed OTP before issuing a new one.
    const { error: invalidateError } = await supabaseAdmin
      .from('otps')
      .update({ is_consumed: true, consumed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_consumed', false);
    if (invalidateError) {
      return NextResponse.json({ error: `Could not invalidate previous OTPs: ${invalidateError.message}` }, { status: 500 });
    }

    // Create fresh OTP
    const code = generateOtp();
    const { data: otp, error } = await supabaseAdmin
      .from('otps')
      .insert({
        user_id: userId,
        code,
        is_consumed: false,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      otp,
      code,
      message: `New OTP generated: ${code}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
