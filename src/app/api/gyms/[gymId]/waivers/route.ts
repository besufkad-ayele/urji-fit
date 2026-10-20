import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view gym waivers.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can view waiver signature records.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data: waivers, error: waiverError } = await supabase
      .from('gym_waivers')
      .select('*')
      .eq('gym_id', gymId)
      .order('version', { ascending: false });
    if (waiverError) throw new Error(`Failed to load gym waivers: ${waiverError.message}`);
    const waiverIds = (waivers ?? []).map((waiver) => waiver.id);
    if (!waiverIds.length) return NextResponse.json({ waivers: [] });

    const { data: acceptances, error: acceptanceError } = await supabase
      .from('gym_waiver_acceptances')
      .select('id, waiver_id, member_id, typed_signature, accepted_at, waiver_version, content_sha256, member:users!gym_waiver_acceptances_member_id_fkey(id, full_name, email, phone)')
      .in('waiver_id', waiverIds)
      .order('accepted_at', { ascending: false });
    if (acceptanceError) throw new Error(`Waivers loaded, but signature records could not be loaded: ${acceptanceError.message}`);
    const signaturesByWaiver = new Map<string, typeof acceptances>();
    for (const acceptance of acceptances ?? []) {
      const rows = signaturesByWaiver.get(acceptance.waiver_id) ?? [];
      rows.push(acceptance);
      signaturesByWaiver.set(acceptance.waiver_id, rows);
    }

    return NextResponse.json({
      waivers: (waivers ?? []).map((waiver) => ({
        ...waiver,
        acceptances: signaturesByWaiver.get(waiver.id) ?? [],
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load gym waivers.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin waiver changes are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to create a gym waiver.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can author waivers.' }, { status: 403 });
    }
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || !('title' in body) || !('content' in body)) {
      return NextResponse.json({ error: 'Waiver title and content are required.' }, { status: 400 });
    }
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 120) {
      return NextResponse.json({ error: 'Waiver title must be 1 to 120 characters.' }, { status: 400 });
    }
    if (typeof body.content !== 'string' || !body.content.trim() || body.content.length > 30000) {
      return NextResponse.json({ error: 'Waiver content must be 1 to 30,000 characters.' }, { status: 400 });
    }

    const { data: waiver, error } = await getSupabaseAdmin().rpc('create_gym_waiver', {
      p_gym_id: gymId,
      p_title: body.title,
      p_content: body.content,
      p_actor_id: user.id,
    });
    if (error) {
      const status = error.code === 'P0002' ? 404 : error.code === '22023' ? 400 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ success: true, waiver }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create gym waiver.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
