import { randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user || !['admin', 'platform_admin'].includes(user.role)) {
      return NextResponse.json({ error: 'An administrator session is required.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    let usersQuery = supabaseAdmin
      .from('users')
      .select('*, otps(*)')
      .order('created_at', { ascending: false });
    if (user.role !== 'platform_admin') {
      usersQuery = usersQuery.in('role', ['member', 'trainer', 'gym_owner']);
    }
    const { data: users, error: userError } = await usersQuery;

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
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin account creation is not allowed.' }, { status: 403 });
  }

  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin || !['admin', 'platform_admin'].includes(admin.role)) {
      return NextResponse.json({ error: 'An administrator session is required.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();
    const { phone, email, full_name, role = 'member', tier = 'free', subscription_status = 'active' } = body;

    const allowedRoles = ['member', 'trainer', 'gym_owner', 'admin', 'platform_admin'];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Choose a valid account role.' }, { status: 400 });
    }
    if (['admin', 'platform_admin'].includes(role) && admin.role !== 'platform_admin') {
      return NextResponse.json({ error: 'Only a platform administrator can create administrator accounts.' }, { status: 403 });
    }
    if (!['free', 'premium'].includes(tier) || !['active', 'expired', 'canceled', 'trial'].includes(subscription_status)) {
      return NextResponse.json({ error: 'Tier or subscription status is invalid.' }, { status: 400 });
    }

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
      const { error: cleanupError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', user.id);
      if (cleanupError) {
        return NextResponse.json(
          { error: `OTP creation failed (${otpError.message}); the incomplete account could not be removed (${cleanupError.message}).` },
          { status: 500 }
        );
      }
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
