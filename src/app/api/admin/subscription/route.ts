import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PATCH(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { userId, tier, subscription_status, subscription_expires_at } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (tier !== undefined) updates.tier = tier;
    if (subscription_status !== undefined) updates.subscription_status = subscription_status;
    if (subscription_expires_at !== undefined) updates.subscription_expires_at = subscription_expires_at;

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
