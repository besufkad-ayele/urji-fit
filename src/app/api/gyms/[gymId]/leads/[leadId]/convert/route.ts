import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string; leadId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin lead conversion is not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to convert a lead.' }, { status: 401 });
    const { gymId, leadId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can convert leads.' }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || !('plan_id' in body) || typeof body.plan_id !== 'string') {
      return NextResponse.json({ error: 'Choose an active membership plan.' }, { status: 400 });
    }
    const startDate = 'start_date' in body ? body.start_date : new Date().toISOString().slice(0, 10);
    if (!isDate(startDate) || startDate < new Date().toISOString().slice(0, 10)) {
      return NextResponse.json({ error: 'Membership start date must be today or a future date.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: lead, error: leadError } = await supabase
      .from('gym_leads')
      .select('id, full_name, phone, email, status')
      .eq('id', leadId)
      .eq('gym_id', gymId)
      .maybeSingle();
    if (leadError) throw new Error(`Failed to load lead: ${leadError.message}`);
    if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    if (lead.status === 'converted') return NextResponse.json({ error: 'Lead is already converted.' }, { status: 409 });
    if (!lead.email && !lead.phone) {
      return NextResponse.json({ error: 'Add a phone number or email to the lead before conversion.' }, { status: 400 });
    }

    const matchingIds = new Set<string>();
    if (lead.email) {
      for (const email of new Set([lead.email, lead.email.toLowerCase()])) {
        const { data: byEmail, error } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'member')
          .eq('email', email)
          .limit(2);
        if (error) throw new Error(`Failed to match the lead email to a member account: ${error.message}`);
        for (const account of byEmail ?? []) matchingIds.add(account.id);
      }
    }
    if (lead.phone) {
      const { data: byPhone, error } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'member')
        .eq('phone', lead.phone)
        .limit(2);
      if (error) throw new Error(`Failed to match the lead phone to a member account: ${error.message}`);
      for (const account of byPhone ?? []) matchingIds.add(account.id);
    }
    if (matchingIds.size === 0) {
      return NextResponse.json({
        error: 'Create the member account in Admin using this lead’s exact phone number or email, then retry conversion.',
      }, { status: 409 });
    }
    if (matchingIds.size > 1) {
      return NextResponse.json({
        error: 'The lead phone and email match different member accounts. Correct the lead contact details before converting.',
      }, { status: 409 });
    }

    const memberId = [...matchingIds][0];
    const { data, error } = await supabase.rpc('convert_gym_lead', {
      p_gym_id: gymId,
      p_lead_id: leadId,
      p_member_id: memberId,
      p_plan_id: body.plan_id,
      p_start_date: startDate,
      p_actor_id: user.id,
    });
    if (error) {
      const status = error.code === 'P0002' ? 404 : error.code === '23505' ? 409 : error.code === '22023' ? 400 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ success: true, conversion: Array.isArray(data) ? data[0] : data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to convert lead.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
