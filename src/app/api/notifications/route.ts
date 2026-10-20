import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view notifications.' }, { status: 401 });
    const { data: notifications, error } = await getSupabaseAdmin()
      .from('gym_notifications')
      .select('id, gym_id, category, title, body, action_url, read_at, created_at, gym:gyms!gym_notifications_gym_id_fkey(name)')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(`Failed to load notifications: ${error.message}`);
    return NextResponse.json({ notifications: notifications ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load notifications.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin notification changes are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to update notifications.' }, { status: 401 });
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null ||
      !('notification_id' in body) || typeof body.notification_id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.notification_id)) {
      return NextResponse.json({ error: 'Choose a valid notification to mark as read.' }, { status: 400 });
    }
    const { data, error } = await getSupabaseAdmin()
      .from('gym_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', body.notification_id)
      .eq('recipient_id', user.id)
      .is('read_at', null)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(`Failed to update notification: ${error.message}`);
    return NextResponse.json({ success: true, updated: Boolean(data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update notification.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
