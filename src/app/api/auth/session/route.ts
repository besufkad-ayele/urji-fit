import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { active: false, message: 'Your session is no longer active. Please sign in again.' },
        { status: 401 }
      );
    }

    const { error } = await getSupabaseAdmin()
      .from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw new Error(`Failed to update session activity: ${error.message}`);

    return NextResponse.json({ active: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to validate session.';
    return NextResponse.json({ active: false, error: message }, { status: 500 });
  }
}
