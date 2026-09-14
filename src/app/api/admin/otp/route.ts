import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    // Invalidate prior unconsumed OTPs (preserving demo bypass codes 123456 & 999999)
    await supabaseAdmin
      .from('otps')
      .update({ is_consumed: true, consumed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_consumed', false)
      .not('code', 'in', '("123456","999999")');

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
