import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin device revocation is not allowed.' }, { status: 403 });
  }

  try {
    const admin = await getAuthenticatedUser(req);
    if (!admin || !['admin', 'platform_admin'].includes(admin.role)) {
      return NextResponse.json({ error: 'An administrator session is required.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (targetUserError) {
      return NextResponse.json({ error: `Could not verify target account: ${targetUserError.message}` }, { status: 500 });
    }
    if (!targetUser) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    if (
      ['admin', 'platform_admin'].includes(targetUser.role) &&
      admin.role !== 'platform_admin'
    ) {
      return NextResponse.json(
        { error: 'Only a platform administrator can revoke an administrator device.' },
        { status: 403 }
      );
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update({
        current_device_id: null,
        device_name: null,
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Active device revoked. User will be prompted to authenticate on their next action.',
      user,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
