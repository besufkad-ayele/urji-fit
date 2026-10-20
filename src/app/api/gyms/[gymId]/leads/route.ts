import { NextRequest, NextResponse } from 'next/server';
import { canManageGym, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { recordGymAuditEvent } from '@/lib/gym-audit';

const LEAD_STATUSES = ['inquiry', 'trial', 'converted', 'lost'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view gym leads.' }, { status: 401 });

    const { gymId } = await params;
    if (!(await canManageGym(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to view this gym pipeline.' }, { status: 403 });
    }

    const { data: leads, error } = await getSupabaseAdmin()
      .from('gym_leads')
      .select('*')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load gym leads: ${error.message}`);
    return NextResponse.json({ leads });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load gym leads.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin lead changes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to manage gym leads.' }, { status: 401 });

    const { gymId } = await params;
    if (!(await canManageGym(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to manage this gym pipeline.' }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (!isRecord(body)) return NextResponse.json({ error: 'Lead data must be an object.' }, { status: 400 });
    const { full_name, phone, email, source, notes } = body;
    if (typeof full_name !== 'string' || !full_name.trim() || full_name.trim().length > 120) {
      return NextResponse.json({ error: 'Lead name is required and must be 120 characters or fewer.' }, { status: 400 });
    }
    if ((typeof phone !== 'string' || !phone.trim()) && (typeof email !== 'string' || !email.trim())) {
      return NextResponse.json({ error: 'Provide a phone number or email address.' }, { status: 400 });
    }
    if (typeof phone === 'string' && phone.length > 40) return NextResponse.json({ error: 'Phone number is too long.' }, { status: 400 });
    if (typeof email === 'string' && email.length > 254) return NextResponse.json({ error: 'Email address is too long.' }, { status: 400 });
    if (typeof source === 'string' && source.length > 100) return NextResponse.json({ error: 'Lead source is too long.' }, { status: 400 });
    if (typeof notes === 'string' && notes.length > 3000) return NextResponse.json({ error: 'Notes must be 3,000 characters or fewer.' }, { status: 400 });

    const { data: lead, error } = await getSupabaseAdmin()
      .from('gym_leads')
      .insert({
        gym_id: gymId,
        full_name: full_name.trim(),
        phone: typeof phone === 'string' ? phone.trim() || null : null,
        email: typeof email === 'string' ? email.trim().toLowerCase() || null : null,
        source: typeof source === 'string' ? source.trim() || null : null,
        notes: typeof notes === 'string' ? notes.trim() || null : null,
      })
      .select('*')
      .single();
    if (error) throw new Error(`Failed to create gym lead: ${error.message}`);
    await recordGymAuditEvent({
      gymId,
      actorId: user.id,
      action: 'lead_created',
      targetType: 'lead',
      targetId: lead.id,
      details: { status: lead.status },
    });
    return NextResponse.json({ success: true, lead }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create gym lead.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin lead changes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to update gym leads.' }, { status: 401 });

    const { gymId } = await params;
    if (!(await canManageGym(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to manage this gym pipeline.' }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'A lead ID and update data are required.' }, { status: 400 });
    }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('status' in body) {
      if (!LEAD_STATUSES.includes(body.status as (typeof LEAD_STATUSES)[number])) {
        return NextResponse.json({ error: 'Choose a valid lead status.' }, { status: 400 });
      }
      if (body.status === 'converted') {
        return NextResponse.json({ error: 'Use lead conversion to associate the member and create a membership.' }, { status: 400 });
      }
      updates.status = body.status;
    }
    if ('notes' in body) {
      if (body.notes !== null && (typeof body.notes !== 'string' || body.notes.length > 3000)) {
        return NextResponse.json({ error: 'Notes must be 3,000 characters or fewer.' }, { status: 400 });
      }
      updates.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
    }
    if ('trial_at' in body) {
      if (body.trial_at !== null && (typeof body.trial_at !== 'string' || Number.isNaN(Date.parse(body.trial_at)))) {
        return NextResponse.json({ error: 'Provide a valid trial date and time.' }, { status: 400 });
      }
      updates.trial_at = body.trial_at;
      if (body.trial_at) updates.status = 'trial';
    }
    if (Object.keys(updates).length === 1) return NextResponse.json({ error: 'No lead changes were provided.' }, { status: 400 });

    const { data: lead, error } = await getSupabaseAdmin()
      .from('gym_leads')
      .update(updates)
      .eq('id', body.id)
      .eq('gym_id', gymId)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`Failed to update gym lead: ${error.message}`);
    if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    await recordGymAuditEvent({
      gymId,
      actorId: user.id,
      action: 'lead_updated',
      targetType: 'lead',
      targetId: lead.id,
      details: { changed_fields: Object.keys(updates).filter((field) => field !== 'updated_at') },
    });
    return NextResponse.json({ success: true, lead });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update gym lead.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
