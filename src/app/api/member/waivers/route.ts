import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view your waivers.' }, { status: 401 });
    if (user.role !== 'member') return NextResponse.json({ error: 'Only members can view member waivers.' }, { status: 403 });

    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const { data: memberships, error: membershipError } = await supabase
      .from('gym_memberships')
      .select('gym_id')
      .eq('member_id', user.id)
      .eq('status', 'active')
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`);
    if (membershipError) throw new Error(`Failed to load active memberships: ${membershipError.message}`);
    const gymIds = [...new Set((memberships ?? []).map((membership) => membership.gym_id))];
    if (!gymIds.length) return NextResponse.json({ waivers: [] });

    const { data: waivers, error: waiverError } = await supabase
      .from('gym_waivers')
      .select('id, gym_id, title, content, version, created_at, gym:gyms!gym_waivers_gym_id_fkey(name)')
      .in('gym_id', gymIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (waiverError) throw new Error(`Failed to load active waivers: ${waiverError.message}`);
    const waiverIds = (waivers ?? []).map((waiver) => waiver.id);
    if (!waiverIds.length) return NextResponse.json({ waivers: [] });

    const { data: acceptances, error: acceptanceError } = await supabase
      .from('gym_waiver_acceptances')
      .select('id, waiver_id, typed_signature, accepted_at, waiver_version, content_sha256')
      .eq('member_id', user.id)
      .in('waiver_id', waiverIds);
    if (acceptanceError) throw new Error(`Waivers loaded, but signature status could not be loaded: ${acceptanceError.message}`);
    const acceptanceByWaiver = new Map((acceptances ?? []).map((acceptance) => [acceptance.waiver_id, acceptance]));

    return NextResponse.json({
      waivers: (waivers ?? []).map((waiver) => ({
        ...waiver,
        acceptance: acceptanceByWaiver.get(waiver.id) ?? null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load your waivers.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
