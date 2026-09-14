import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { credential, otp, deviceId, deviceName } = await req.json();

    if (!credential || !otp || !deviceId) {
      return NextResponse.json(
        { error: 'Credential, OTP, and Device ID are required.' },
        { status: 400 }
      );
    }

    const cleanCred = credential.trim();
    const cleanOtp = otp.trim();

    // 1. Look up user by phone or email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .or(`phone.eq.${cleanCred},email.eq.${cleanCred}`)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'No account found with this phone or email. Please ask your administrator to register you.' },
        { status: 404 }
      );
    }

    // 2. Validate OTP
    const isDemoLogin =
      (user.email === 'bes@urjifit.com' && cleanOtp === '123456') ||
      (user.email === 'admin@urjifit.com' && cleanOtp === '999999');

    let validOtpId: string | null = null;

    if (isDemoLogin) {
      // Find or create valid OTP for demo account
      const { data: demoOtp } = await supabaseAdmin
        .from('otps')
        .select('*')
        .eq('user_id', user.id)
        .eq('code', cleanOtp)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      validOtpId = demoOtp?.id || null;
    } else {
      const { data: validOtp, error: otpError } = await supabaseAdmin
        .from('otps')
        .select('*')
        .eq('user_id', user.id)
        .eq('code', cleanOtp)
        .eq('is_consumed', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (otpError || !validOtp) {
        return NextResponse.json(
          { error: 'Invalid or expired OTP. Please check with your administrator.' },
          { status: 401 }
        );
      }
      validOtpId = validOtp.id;
    }

    // 3. Mark OTP as consumed (for non-demo users)
    if (validOtpId && !isDemoLogin) {
      await supabaseAdmin
        .from('otps')
        .update({
          is_consumed: true,
          consumed_at: new Date().toISOString(),
          device_id: deviceId,
        })
        .eq('id', validOtpId);
    }

    // 4. Bind device to user (Single device lock: replaces previous device)
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        current_device_id: deviceId,
        device_name: deviceName || 'Web Browser',
        last_active_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('*')
      .single();

    if (updateError || !updatedUser) {
      return NextResponse.json({ error: 'Failed to bind device.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'Authentication successful. Device bound.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
