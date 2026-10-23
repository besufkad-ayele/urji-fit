import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const SESSION_COOKIE_NAME = 'urji_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SessionUser {
  id: string;
  role: 'member' | 'trainer' | 'gym_owner' | 'admin' | 'platform_admin';
  current_device_id: string | null;
  home_gym_id: string | null;
}

interface SessionPayload {
  userId: string;
  deviceId: string;
  expiresAt: number;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be configured with at least 32 characters.');
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

export function assertSessionConfiguration(): void {
  getSessionSecret();
}

export function setSessionCookie(
  response: NextResponse,
  userId: string,
  deviceId: string
): void {
  const payload: SessionPayload = {
    userId,
    deviceId,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  response.cookies.set(SESSION_COOKIE_NAME, `${encodedPayload}.${sign(encodedPayload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getAuthenticatedUser(
  request: NextRequest
): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const [encodedPayload, providedSignature, extra] = token.split('.');
  if (!encodedPayload || !providedSignature || extra) return null;

  const expectedSignature = sign(encodedPayload);
  const expectedBytes = Buffer.from(expectedSignature);
  const providedBytes = Buffer.from(providedSignature);
  if (
    expectedBytes.length !== providedBytes.length ||
    !timingSafeEqual(expectedBytes, providedBytes)
  ) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (
    typeof payload.userId !== 'string' ||
    typeof payload.deviceId !== 'string' ||
    typeof payload.expiresAt !== 'number' ||
    payload.expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  const { data: user, error } = await getSupabaseAdmin()
    .from('users')
    .select('*')
    .eq('id', payload.userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to validate session: ${error.message}`);
  if (!user || user.current_device_id !== payload.deviceId) return null;

  return user as SessionUser;
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function canManageGym(user: SessionUser, gymId: string): Promise<boolean> {
  if (user.role === 'admin' || user.role === 'platform_admin') return true;

  const supabaseAdmin = getSupabaseAdmin();
  if (user.role === 'gym_owner') {
    const { data, error } = await supabaseAdmin
      .from('gyms')
      .select('id')
      .eq('id', gymId)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (error) throw new Error(`Failed to validate gym ownership: ${error.message}`);
    if (data) return true;
  }

  const { data, error } = await supabaseAdmin
    .from('gym_staff')
    .select('id')
    .eq('gym_id', gymId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('position', ['manager', 'receptionist'])
    .maybeSingle();
  if (error) throw new Error(`Failed to validate gym staff access: ${error.message}`);
  return Boolean(data);
}

export async function canConfigureGymPayments(
  user: SessionUser,
  gymId: string
): Promise<boolean> {
  if (user.role === 'admin' || user.role === 'platform_admin') return true;

  const supabaseAdmin = getSupabaseAdmin();
  if (user.role === 'gym_owner') {
    const { data, error } = await supabaseAdmin
      .from('gyms')
      .select('id')
      .eq('id', gymId)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (error) throw new Error(`Failed to validate gym ownership: ${error.message}`);
    if (data) return true;
  }

  const { data, error } = await supabaseAdmin
    .from('gym_staff')
    .select('id')
    .eq('gym_id', gymId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('position', 'manager')
    .maybeSingle();
  if (error) throw new Error(`Failed to validate payment settings access: ${error.message}`);
  return Boolean(data);
}
