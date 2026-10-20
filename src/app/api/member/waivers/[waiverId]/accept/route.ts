import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ waiverId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin waiver signatures are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to sign a waiver.' }, { status: 401 });
    if (user.role !== 'member') return NextResponse.json({ error: 'Only members can sign member waivers.' }, { status: 403 });
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || !('typed_signature' in body) || typeof body.typed_signature !== 'string') {
      return NextResponse.json({ error: 'Type your full account name to sign this waiver.' }, { status: 400 });
    }
    const { waiverId } = await params;
    const supabase = getSupabaseAdmin();
    const { data: waiver, error: waiverError } = await supabase
      .from('gym_waivers')
      .select('id, content')
      .eq('id', waiverId)
      .eq('is_active', true)
      .maybeSingle();
    if (waiverError) throw new Error(`Failed to load waiver: ${waiverError.message}`);
    if (!waiver) return NextResponse.json({ error: 'This waiver is no longer active.' }, { status: 404 });

    const contentHash = createHash('sha256').update(waiver.content, 'utf8').digest('hex');
    const { data: acceptance, error } = await supabase.rpc('accept_gym_waiver', {
      p_waiver_id: waiver.id,
      p_member_id: user.id,
      p_typed_signature: body.typed_signature,
      p_content_sha256: contentHash,
    });
    if (error) {
      const status = error.code === 'P0002' ? 404 : error.code === '42501' ? 403 : error.code === '23505' ? 409 : error.code === '22023' ? 400 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ success: true, acceptance });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sign waiver.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
