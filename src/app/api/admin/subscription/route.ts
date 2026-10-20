import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PATCH(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin subscription updates are not allowed.' }, { status: 403 });
  }

  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin || !['admin', 'platform_admin'].includes(admin.role)) {
      return NextResponse.json({ error: 'An administrator session is required.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { userId, tier, subscription_status, subscription_expires_at } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }
    if (tier !== undefined && !['free', 'premium'].includes(tier)) {
      return NextResponse.json({ error: 'Tier must be free or premium.' }, { status: 400 });
    }
    if (
      subscription_status !== undefined &&
      !['active', 'expired', 'canceled', 'trial'].includes(subscription_status)
    ) {
      return NextResponse.json({ error: 'Subscription status is invalid.' }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    if (tier !== undefined) updates.tier = tier;
    if (subscription_status !== undefined) updates.subscription_status = subscription_status;
    if (subscription_expires_at !== undefined) updates.subscription_expires_at = subscription_expires_at;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No subscription changes were provided.' }, { status: 400 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
