import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveThread(userId: string, role: string, partnerId: string, gymId: string) {
  const trainerId = role === 'trainer' ? userId : partnerId;
  const clientId = role === 'member' ? userId : partnerId;
  const supabase = getSupabaseAdmin();
  const [{ data: assignment, error }, accessResult] = await Promise.all([
    supabase
    .from('trainer_assignments')
    .select('id')
    .eq('gym_id', gymId)
    .eq('trainer_id', trainerId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle(),
    role === 'trainer'
      ? supabase.from('gym_staff').select('id')
        .eq('gym_id', gymId).eq('user_id', userId).eq('status', 'active')
        .in('position', ['trainer', 'head_trainer']).maybeSingle()
      : supabase.from('gym_memberships').select('id')
        .eq('gym_id', gymId).eq('member_id', userId).eq('status', 'active')
        .lte('start_date', new Date().toISOString().slice(0, 10))
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString().slice(0, 10)}`)
        .limit(1).maybeSingle(),
  ]);
  if (error) throw new Error(`Failed to verify coaching relationship: ${error.message}`);
  if (accessResult.error) throw new Error(`Failed to verify account access: ${accessResult.error.message}`);
  return assignment && accessResult.data ? { trainerId, clientId } : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || !['trainer', 'member'].includes(user.role)) {
      return NextResponse.json({ error: 'A signed-in trainer or member account is required.' }, { status: 403 });
    }
    const partnerId = request.nextUrl.searchParams.get('partnerId');
    const gymId = request.nextUrl.searchParams.get('gymId');
    if (!isUuid(partnerId) || !isUuid(gymId)) {
      return NextResponse.json({ error: 'A valid coach/client and gym are required.' }, { status: 400 });
    }
    const thread = await resolveThread(user.id, user.role, partnerId, gymId);
    if (!thread) return NextResponse.json({ error: 'Messages are only available for an active coaching relationship.' }, { status: 403 });

    const supabase = getSupabaseAdmin();
    const { data: messages, error } = await supabase
      .from('trainer_messages')
      .select('id, gym_id, trainer_id, client_id, sender_id, recipient_id, content, read_at, created_at')
      .eq('gym_id', gymId)
      .eq('trainer_id', thread.trainerId)
      .eq('client_id', thread.clientId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw new Error(`Failed to load coaching messages: ${error.message}`);

    const { error: readError } = await supabase
      .from('trainer_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('gym_id', gymId)
      .eq('trainer_id', thread.trainerId)
      .eq('client_id', thread.clientId)
      .eq('recipient_id', user.id)
      .is('read_at', null);
    if (readError) throw new Error(`Messages loaded, but unread status could not be updated: ${readError.message}`);
    return NextResponse.json({ messages: (messages ?? []).reverse() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load coaching messages.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin messages are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || !['trainer', 'member'].includes(user.role)) {
      return NextResponse.json({ error: 'A signed-in trainer or member account is required.' }, { status: 403 });
    }
    const body: unknown = await request.json();
    if (!isRecord(body) || !isUuid(body.partner_id) || !isUuid(body.gym_id) ||
      typeof body.content !== 'string' || body.content.trim().length < 1 || body.content.trim().length > 4000) {
      return NextResponse.json({ error: 'Provide a valid coaching conversation and a message up to 4,000 characters.' }, { status: 400 });
    }
    const thread = await resolveThread(user.id, user.role, body.partner_id, body.gym_id);
    if (!thread) return NextResponse.json({ error: 'Messages are only available for an active coaching relationship.' }, { status: 403 });

    const recipientId = user.id === thread.trainerId ? thread.clientId : thread.trainerId;
    const { data: message, error } = await getSupabaseAdmin()
      .from('trainer_messages')
      .insert({
        gym_id: body.gym_id,
        trainer_id: thread.trainerId,
        client_id: thread.clientId,
        sender_id: user.id,
        recipient_id: recipientId,
        content: body.content.trim(),
      })
      .select('id, gym_id, trainer_id, client_id, sender_id, recipient_id, content, read_at, created_at')
      .single();
    if (error) throw new Error(`Failed to send coaching message: ${error.message}`);
    return NextResponse.json({ success: true, message }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send coaching message.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
