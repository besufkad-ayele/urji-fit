import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view the gym audit log.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can view audit logs.' }, { status: 403 });
    }
    const requestedLimit = Number(request.nextUrl.searchParams.get('limit') ?? 100);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
      return NextResponse.json({ error: 'Audit log limit must be a positive integer.' }, { status: 400 });
    }
    const limit = Math.min(requestedLimit, 250);
    const { data: events, error } = await getSupabaseAdmin()
      .from('gym_audit_logs')
      .select('id, actor_id, action, target_type, target_id, details, created_at, actor:users!gym_audit_logs_actor_id_fkey(id, full_name, email)')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Failed to load gym audit log: ${error.message}`);
    return NextResponse.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load gym audit log.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
