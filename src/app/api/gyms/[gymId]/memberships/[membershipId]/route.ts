import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { recordGymAuditEvent } from '@/lib/gym-audit';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string; membershipId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin membership changes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to manage memberships.' }, { status: 401 });

    const { gymId, membershipId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to manage memberships for this gym.' }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.action !== 'string') {
      return NextResponse.json({ error: 'Choose a membership action.' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data: current, error: membershipError } = await supabase
      .from('gym_memberships')
      .select('*')
      .eq('id', membershipId)
      .eq('gym_id', gymId)
      .maybeSingle();
    if (membershipError) throw new Error(`Failed to load membership: ${membershipError.message}`);
    if (!current) return NextResponse.json({ error: 'Membership not found.' }, { status: 404 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const auditDetails: Record<string, unknown> = {};

    switch (body.action) {
      case 'freeze':
        if (current.status !== 'active') {
          return NextResponse.json({ error: 'Only active memberships can be frozen.' }, { status: 409 });
        }
        updates.status = 'suspended';
        updates.frozen_at = new Date().toISOString();
        auditDetails.previous_status = current.status;
        break;
      case 'resume': {
        if (current.status !== 'suspended' || !current.frozen_at) {
          return NextResponse.json({ error: 'This membership is not frozen.' }, { status: 409 });
        }
        const frozenAt = new Date(current.frozen_at);
        const elapsedDays = Math.max(0, Math.ceil((Date.now() - frozenAt.getTime()) / 86_400_000));
        updates.status = 'active';
        updates.frozen_at = null;
        if (current.end_date) {
          const endDate = new Date(`${current.end_date}T00:00:00.000Z`);
          updates.end_date = addDays(endDate, elapsedDays);
        }
        auditDetails.frozen_days = elapsedDays;
        break;
      }
      case 'cancel':
        if (current.status === 'canceled') {
          return NextResponse.json({ error: 'Membership is already canceled.' }, { status: 409 });
        }
        updates.status = 'canceled';
        updates.auto_renew = false;
        updates.frozen_at = null;
        break;
      case 'transfer': {
        if (typeof body.member_id !== 'string' || body.member_id === current.member_id) {
          return NextResponse.json({ error: 'Choose a different member account for transfer.' }, { status: 400 });
        }
        const { data: destination, error: destinationError } = await supabase
          .from('users')
          .select('id, role')
          .eq('id', body.member_id)
          .maybeSingle();
        if (destinationError) throw new Error(`Failed to verify transfer member: ${destinationError.message}`);
        if (!destination || destination.role !== 'member') {
          return NextResponse.json({ error: 'Transfer destination must be an existing member account.' }, { status: 400 });
        }
        const { data: destinationMembership, error: destinationMembershipError } = await supabase
          .from('gym_memberships')
          .select('id')
          .eq('gym_id', gymId)
          .eq('member_id', destination.id)
          .in('status', ['active', 'suspended'])
          .or(`end_date.is.null,end_date.gte.${new Date().toISOString().slice(0, 10)}`)
          .maybeSingle();
        if (destinationMembershipError) throw new Error(`Failed to check destination memberships: ${destinationMembershipError.message}`);
        if (destinationMembership) {
          return NextResponse.json({ error: 'Transfer destination already has a current membership at this gym.' }, { status: 409 });
        }
        updates.member_id = destination.id;
        auditDetails.previous_member_id = current.member_id;
        auditDetails.new_member_id = destination.id;
        break;
      }
      case 'change_plan': {
        if (typeof body.plan_id !== 'string') {
          return NextResponse.json({ error: 'Choose a membership plan.' }, { status: 400 });
        }
        const { data: plan, error: planError } = await supabase
          .from('gym_membership_plans')
          .select('id, name, membership_type, price, duration_days, sessions_included, is_active')
          .eq('id', body.plan_id)
          .eq('gym_id', gymId)
          .maybeSingle();
        if (planError) throw new Error(`Failed to load membership plan: ${planError.message}`);
        if (!plan || !plan.is_active) {
          return NextResponse.json({ error: 'Choose an active membership plan at this gym.' }, { status: 400 });
        }
        if (current.status !== 'active') {
          return NextResponse.json({ error: 'Only active memberships can change plans.' }, { status: 409 });
        }
        updates.plan_id = plan.id;
        updates.membership_type = plan.membership_type;
        updates.price = plan.price;
        updates.sessions_remaining = plan.sessions_included;
        if (plan.duration_days) {
          updates.end_date = addDays(new Date(), plan.duration_days);
        }
        auditDetails.plan_id = plan.id;
        auditDetails.plan_name = plan.name;
        auditDetails.previous_plan_id = current.plan_id;
        break;
      }
      default:
        return NextResponse.json({ error: 'Supported actions: freeze, resume, cancel, transfer, change_plan.' }, { status: 400 });
    }

    const { data: membership, error: updateError } = await supabase
      .from('gym_memberships')
      .update(updates)
      .eq('id', membershipId)
      .eq('gym_id', gymId)
      .eq('updated_at', current.updated_at)
      .select('*, member:users!gym_memberships_member_id_fkey(id, full_name, email, phone)')
      .maybeSingle();
    if (updateError) throw new Error(`Failed to update membership: ${updateError.message}`);
    if (!membership) return NextResponse.json({ error: 'Membership changed in another request. Refresh and try again.' }, { status: 409 });

    await recordGymAuditEvent({
      gymId,
      actorId: user.id,
      action: `membership_${body.action}`,
      targetType: 'membership',
      targetId: membership.id,
      details: auditDetails,
    });
    const { error: auditError } = await supabase.from('membership_audit_logs').insert({
      gym_id: gymId,
      membership_id: membershipId,
      actor_id: user.id,
      action: body.action,
      details: auditDetails,
    });
    if (auditError) throw new Error(`Membership changed, but its audit entry could not be saved: ${auditError.message}`);

    return NextResponse.json({ success: true, membership });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update membership.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
