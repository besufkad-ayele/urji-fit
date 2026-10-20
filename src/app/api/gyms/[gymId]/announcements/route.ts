import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view gym announcements.' }, { status: 401 });
    const { gymId } = await params;
    if (!UUID_PATTERN.test(gymId)) return NextResponse.json({ error: 'A valid gym is required.' }, { status: 400 });
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can view announcement history.' }, { status: 403 });
    }
    const { data: announcements, error } = await getSupabaseAdmin()
      .from('gym_announcements')
      .select('id, title, body, created_at, author:users!gym_announcements_author_id_fkey(full_name)')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(`Failed to load announcements: ${error.message}`);
    return NextResponse.json({ announcements: announcements ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load announcements.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin announcements are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to publish an announcement.' }, { status: 401 });
    const { gymId } = await params;
    if (!UUID_PATTERN.test(gymId)) return NextResponse.json({ error: 'A valid gym is required.' }, { status: 400 });
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can publish announcements.' }, { status: 403 });
    }
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null ||
      !('title' in body) || typeof body.title !== 'string' || body.title.trim().length < 1 || body.title.trim().length > 120 ||
      !('body' in body) || typeof body.body !== 'string' || body.body.trim().length < 1 || body.body.trim().length > 4000) {
      return NextResponse.json({ error: 'Enter a title (up to 120 characters) and announcement (up to 4,000 characters).' }, { status: 400 });
    }
    const { data, error } = await getSupabaseAdmin().rpc('publish_gym_announcement', {
      p_gym_id: gymId,
      p_author_id: user.id,
      p_title: body.title.trim(),
      p_body: body.body.trim(),
    });
    if (error) throw new Error(`Failed to publish announcement to member inboxes: ${error.message}`);
    const result = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      announcement_id: result?.announcement_id,
      recipient_count: result?.recipient_count ?? 0,
      delivery: 'in_app',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to publish announcement.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
