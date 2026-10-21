import { NextRequest, NextResponse } from 'next/server';
import {
  hashAdminPassword,
  validateAdminPassword,
  verifyAdminPassword,
} from '@/lib/admin-password';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  assertSessionConfiguration,
  getAuthenticatedUser,
  setSessionCookie,
} from '@/lib/session';

const ADMIN_ROLES = ['admin', 'platform_admin'];
const DEMO_ADMIN_EMAIL = 'admin@urjifit.com';

function isSameOrigin(request: NextRequest): boolean {
  return request.headers.get('origin') === request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getAuthenticatedUser(request);
    if (!admin || !ADMIN_ROLES.includes(admin.role)) {
      return NextResponse.json({ error: 'An administrator session is required.' }, { status: 403 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('admin_password_credentials')
      .select('user_id')
      .eq('user_id', admin.id)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: `Could not check administrator password setup: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ passwordConfigured: Boolean(data) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-origin login requests are not allowed.' }, { status: 403 });
  }

  try {
    assertSessionConfiguration();
    const body: unknown = await request.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('email' in body) ||
      !('password' in body) ||
      !('deviceId' in body) ||
      typeof body.email !== 'string' ||
      typeof body.password !== 'string' ||
      typeof body.deviceId !== 'string' ||
      !body.deviceId
    ) {
      return NextResponse.json({ error: 'Email, password, and device ID are required.' }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const supabaseAdmin = getSupabaseAdmin();
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, phone, full_name, role, tier, subscription_status, subscription_expires_at, current_device_id, device_name, last_active_at, disclaimer_acknowledged_at, onboarding_completed, daily_calorie_target, daily_protein_target, daily_carb_target, daily_fat_target, daily_water_target_ml, target_bedtime, target_waketime, wind_down_offset_minutes, avatar_url, bio, certifications, specializations, created_at, updated_at')
      .eq('email', email)
      .maybeSingle();

    if (userError) {
      return NextResponse.json({ error: `Could not verify administrator account: ${userError.message}` }, { status: 500 });
    }
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Invalid administrator email or password.' }, { status: 401 });
    }
    if (process.env.NODE_ENV === 'production' && email === DEMO_ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Demo accounts cannot be used in production.' }, { status: 401 });
    }

    const { data: credentials, error: credentialsError } = await supabaseAdmin
      .from('admin_password_credentials')
      .select('password_hash, failed_attempts, locked_until')
      .eq('user_id', user.id)
      .maybeSingle();

    if (credentialsError) {
      return NextResponse.json({ error: `Could not verify administrator credentials: ${credentialsError.message}` }, { status: 500 });
    }
    if (!credentials) {
      return NextResponse.json({ error: 'Password sign-in is not set up for this administrator yet.' }, { status: 401 });
    }
    if (credentials.locked_until && new Date(credentials.locked_until).getTime() > Date.now()) {
      return NextResponse.json({ error: 'Too many failed attempts. Try again after the temporary lock expires.' }, { status: 429 });
    }

    const passwordValid = await verifyAdminPassword(body.password, credentials.password_hash);
    if (!passwordValid) {
      const { error: attemptError } = await supabaseAdmin.rpc(
        'record_admin_password_failure',
        { p_user_id: user.id }
      );
      if (attemptError) {
        return NextResponse.json({ error: `Could not safely record failed login: ${attemptError.message}` }, { status: 500 });
      }
      return NextResponse.json({ error: 'Invalid administrator email or password.' }, { status: 401 });
    }

    const deviceName =
      'deviceName' in body && typeof body.deviceName === 'string'
        ? body.deviceName.slice(0, 120)
        : 'Web Browser';
    const { error: resetError } = await supabaseAdmin
      .from('admin_password_credentials')
      .update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    if (resetError) {
      return NextResponse.json({ error: `Could not reset login attempt counter: ${resetError.message}` }, { status: 500 });
    }

    const deviceId = body.deviceId;
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        current_device_id: deviceId,
        device_name: deviceName,
        last_active_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('id, email, phone, full_name, role, tier, subscription_status, subscription_expires_at, current_device_id, device_name, last_active_at, disclaimer_acknowledged_at, onboarding_completed, daily_calorie_target, daily_protein_target, daily_carb_target, daily_fat_target, daily_water_target_ml, target_bedtime, target_waketime, wind_down_offset_minutes, avatar_url, bio, certifications, specializations, created_at, updated_at')
      .single();

    if (updateError || !updatedUser) {
      return NextResponse.json({ error: 'Failed to bind administrator session to this device.' }, { status: 500 });
    }

    const response = NextResponse.json({ success: true, user: updatedUser });
    setSessionCookie(response, updatedUser.id, deviceId);
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-origin password changes are not allowed.' }, { status: 403 });
  }

  try {
    const admin = await getAuthenticatedUser(request);
    if (!admin || !ADMIN_ROLES.includes(admin.role)) {
      return NextResponse.json({ error: 'An administrator session is required to change this password.' }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('newPassword' in body) ||
      ('currentPassword' in body && typeof body.currentPassword !== 'string') ||
      !validateAdminPassword(body.newPassword)
    ) {
      return NextResponse.json({ error: 'Enter a new password of 12–128 characters and your current password if one is already configured.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: credentials, error: credentialsError } = await supabaseAdmin
      .from('admin_password_credentials')
      .select('password_hash')
      .eq('user_id', admin.id)
      .maybeSingle();
    if (credentialsError) {
      return NextResponse.json({ error: `Could not verify administrator credentials: ${credentialsError.message}` }, { status: 500 });
    }
    if (credentials) {
      if (
        !('currentPassword' in body) ||
        typeof body.currentPassword !== 'string' ||
        !(await verifyAdminPassword(body.currentPassword, credentials.password_hash))
      ) {
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
      }
    }

    const passwordHash = await hashAdminPassword(body.newPassword);
    if (credentials) {
      const { error: updateError } = await supabaseAdmin
        .from('admin_password_credentials')
        .update({
          password_hash: passwordHash,
          failed_attempts: 0,
          locked_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', admin.id);
      if (updateError) {
        return NextResponse.json({ error: `Could not update administrator password: ${updateError.message}` }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('admin_password_credentials')
        .insert({ user_id: admin.id, password_hash: passwordHash });
      if (insertError?.code === '23505') {
        return NextResponse.json({ error: 'A password was just set for this account. Refresh the page and enter it as your current password to make changes.' }, { status: 409 });
      }
      if (insertError) {
        return NextResponse.json({ error: `Could not set administrator password: ${insertError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      passwordConfigured: true,
      message: credentials ? 'Administrator password updated.' : 'Administrator password set.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
