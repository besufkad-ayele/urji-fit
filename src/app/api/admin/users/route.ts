import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function GET() {
  try {
    const { data: users, error: userError } = await supabaseAdmin
      .from('users')
      .select('*, otps(*)')
      .order('created_at', { ascending: false });

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    return NextResponse.json({ users });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, email, full_name, role = 'user', tier = 'free', subscription_status = 'active' } = body;

    if (!full_name || (!phone && !email)) {
      return NextResponse.json(
        { error: 'Full name and at least one contact method (phone or email) are required.' },
        { status: 400 }
      );
    }

    // Insert user
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        full_name: full_name.trim(),
        role,
        tier,
        subscription_status,
      })
      .select('*')
      .single();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 400 });
    }

    // Generate initial single-use OTP
    const code = generateOtp();
    const { data: otp, error: otpError } = await supabaseAdmin
      .from('otps')
      .insert({
        user_id: user.id,
        code,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('*')
      .single();

    if (otpError) {
      return NextResponse.json({ error: otpError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user,
      otp,
      message: `User created. OTP is ${code}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
