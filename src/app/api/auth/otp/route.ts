import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const DEMO_ACCOUNTS = {
  'bes@urjifit.com': {
    role: 'member',
    otp: '123456',
  },
  'owner@gymone.com': {
    role: 'gym_owner',
    otp: '666666',
  },
  'coach@urjifit.com': {
    role: 'trainer',
    otp: '222222',
  },
  'admin@urjifit.com': {
    role: 'platform_admin',
    otp: '999999',
  },
} as const;

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
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
    const normalizedEmail =
      typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
    const demoAccount = Object.entries(DEMO_ACCOUNTS).find(
      ([email]) => normalizedEmail === email
    )?.[1];
    const isDemoLogin = Boolean(demoAccount && cleanOtp === demoAccount.otp);

    let validOtpId: string | null = null;

    if (!isDemoLogin) {
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
        ...(isDemoLogin && demoAccount && user.role !== demoAccount.role
          ? { role: demoAccount.role }
          : {}),
      })
      .eq('id', user.id)
      .select('*')
      .single();

    if (updateError || !updatedUser) {
      return NextResponse.json({ error: 'Failed to bind device.' }, { status: 500 });
    }

    console.log('[AUTH API] Login successful for user:', updatedUser.email, 'Role:', updatedUser.role);

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
