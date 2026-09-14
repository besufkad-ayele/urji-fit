import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update({
        disclaimer_acknowledged_at: new Date().toISOString(),
        onboarding_completed: true,
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Failed to update disclaimer' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
