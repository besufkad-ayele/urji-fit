import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

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

    console.log('[AUTH API] Login attempt:', { credential: cleanCred, otp: cleanOtp });

    // 1. Look up user by phone or email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .or(`phone.eq.${cleanCred},email.eq.${cleanCred}`)
      .maybeSingle();

    console.log('[AUTH API] User lookup result:', { user: user?.email, error: userError?.message });

    if (userError || !user) {
      console.log('[AUTH API] User not found:', cleanCred);
      return NextResponse.json(
        { error: 'No account found with this phone or email. Please ask your administrator to register you.' },
        { status: 404 }
      );
    }

    // 2. Validate OTP
    // Demo accounts: check if email contains @urjifit.com or specific phone numbers
    const demoEmails = ['admin@urjifit.com', 'bes@urjifit.com', 'coach@urjifit.com', 'mike@urjifit.com', 
                       'ruth@urjifit.com', 'member1@urjifit.com', 'owner@gymone.com', 'sarah@fitnesshub.com'];
    const demoPhones = ['+251900000000', '+251911000001', '+251911000002', '+251911000010', 
                       '+251911000011', '+251911000012', '+251912345678', '+251912000001'];
    
    const isDemoLogin = 
      (user.email && demoEmails.includes(user.email)) ||
      (user.phone && demoPhones.includes(user.phone)) ||
      (user.email && user.email.includes('@urjifit.com')) ||
      (user.email && user.email.includes('@gymone.com')) ||
      (user.email && user.email.includes('@fitnesshub.com'));

    console.log('[AUTH API] Demo login check:', { isDemoLogin, email: user.email, phone: user.phone });

    let validOtpId: string | null = null;

    if (isDemoLogin) {
      // Find valid OTP for demo account (can be reused, ignore is_consumed)
      const { data: demoOtp } = await supabaseAdmin
        .from('otps')
        .select('*')
        .eq('user_id', user.id)
        .eq('code', cleanOtp)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('[AUTH API] Demo OTP lookup:', { found: !!demoOtp, code: cleanOtp });

      if (!demoOtp) {
        return NextResponse.json(
          { error: 'Invalid OTP code. Please check the demo login buttons.' },
          { status: 401 }
        );
      }
      validOtpId = demoOtp.id;
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
