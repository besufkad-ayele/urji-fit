import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { recordGymAuditEvent } from '@/lib/gym-audit';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validAvatarUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string; membershipId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view member records.' }, { status: 401 });

    const { gymId, membershipId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can view private member records.' }, { status: 403 });
    }

    const { data: membership, error } = await getSupabaseAdmin()
      .from('gym_memberships')
      .select(`
        id,
        gym_id,
        member_id,
        membership_type,
        plan_id,
        price,
        start_date,
        end_date,
        status,
        auto_renew,
        sessions_remaining,
        frozen_at,
        household_id,
        member:users!gym_memberships_member_id_fkey(id, full_name, email, phone, avatar_url, created_at),
        profile:member_profiles!member_profiles_member_id_fkey(member_id, emergency_contact_name, emergency_contact_phone, medical_notes, goals, tags, date_of_birth, address)
      `)
      .eq('id', membershipId)
      .eq('gym_id', gymId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load member record: ${error.message}`);
    if (!membership) return NextResponse.json({ error: 'Membership not found.' }, { status: 404 });
    return NextResponse.json({ membership });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load member record.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string; membershipId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin member changes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to update member records.' }, { status: 401 });

    const { gymId, membershipId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can update private member records.' }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (!isRecord(body)) return NextResponse.json({ error: 'Member changes must be an object.' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: membership, error: lookupError } = await supabase
      .from('gym_memberships')
      .select('id, gym_id, member_id')
      .eq('id', membershipId)
      .eq('gym_id', gymId)
      .maybeSingle();
    if (lookupError) throw new Error(`Failed to verify member record: ${lookupError.message}`);
    if (!membership) return NextResponse.json({ error: 'Membership not found.' }, { status: 404 });

    const userUpdates: Record<string, string | null> = {};
    const profileUpdates: Record<string, string | string[] | null> = {
      member_id: membership.member_id,
      updated_at: new Date().toISOString(),
    };
    if ('full_name' in body) {
      if (typeof body.full_name !== 'string' || !body.full_name.trim() || body.full_name.trim().length > 120) {
        return NextResponse.json({ error: 'Member name is required and must be 120 characters or fewer.' }, { status: 400 });
      }
      userUpdates.full_name = body.full_name.trim();
    }
    if ('email' in body) {
      if (body.email !== null && (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))) {
        return NextResponse.json({ error: 'Enter a valid email address or leave it blank.' }, { status: 400 });
      }
      userUpdates.email = typeof body.email === 'string' ? body.email.trim().toLowerCase() || null : null;
    }
    if ('phone' in body) {
      if (body.phone !== null && (typeof body.phone !== 'string' || body.phone.length > 40)) {
        return NextResponse.json({ error: 'Phone must be 40 characters or fewer.' }, { status: 400 });
      }
      userUpdates.phone = typeof body.phone === 'string' ? body.phone.trim() || null : null;
    }
    if ('avatar_url' in body) {
      if (body.avatar_url !== null && (typeof body.avatar_url !== 'string' || body.avatar_url.length > 2048 || !validAvatarUrl(body.avatar_url))) {
        return NextResponse.json({ error: 'Photo URL must be a valid HTTP or HTTPS URL.' }, { status: 400 });
      }
      userUpdates.avatar_url = typeof body.avatar_url === 'string' ? body.avatar_url.trim() || null : null;
    }

    for (const field of ['emergency_contact_name', 'emergency_contact_phone', 'medical_notes', 'goals', 'address', 'date_of_birth'] as const) {
      if (!(field in body)) continue;
      const value = body[field];
      const limit = field === 'medical_notes' || field === 'goals' || field === 'address' ? 3000 : 120;
      if (field === 'date_of_birth') {
        if (
          value !== null &&
          (typeof value !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
            Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) ||
            new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value)
        ) {
          return NextResponse.json({ error: 'Date of birth must use YYYY-MM-DD format.' }, { status: 400 });
        }
        profileUpdates.date_of_birth = typeof value === 'string' ? value : null;
      } else {
        if (value !== null && (typeof value !== 'string' || value.length > limit)) {
          return NextResponse.json({ error: `${field.replaceAll('_', ' ')} must be ${limit} characters or fewer.` }, { status: 400 });
        }
        profileUpdates[field] = typeof value === 'string' ? value.trim() || null : null;
      }
    }
    if ('tags' in body) {
      if (!Array.isArray(body.tags) || body.tags.length > 20 || body.tags.some((tag) => typeof tag !== 'string' || tag.trim().length > 40)) {
        return NextResponse.json({ error: 'Tags must be a list of up to 20 labels, each 40 characters or fewer.' }, { status: 400 });
      }
      profileUpdates.tags = [...new Set(body.tags.map((tag: string) => tag.trim()).filter(Boolean))];
    }
    if (Object.keys(userUpdates).length === 0 && Object.keys(profileUpdates).length === 2) {
      return NextResponse.json({ error: 'No member changes were provided.' }, { status: 400 });
    }

    if (Object.keys(userUpdates).length) {
      const { error: userError } = await supabase
        .from('users')
        .update({ ...userUpdates, updated_at: new Date().toISOString() })
        .eq('id', membership.member_id)
        .eq('role', 'member');
      if (userError) {
        if (userError.code === '23505') return NextResponse.json({ error: 'That email or phone number is already assigned to another account.' }, { status: 409 });
        throw new Error(`Failed to update member contact details: ${userError.message}`);
      }
    }

    if (Object.keys(profileUpdates).length > 2) {
      const { error: profileError } = await supabase
        .from('member_profiles')
        .upsert(profileUpdates, { onConflict: 'member_id' });
      if (profileError) throw new Error(`Contact details were updated, but the member profile could not be saved: ${profileError.message}`);
    }

    await recordGymAuditEvent({
      gymId,
      actorId: user.id,
      action: 'member_record_updated',
      targetType: 'member',
      targetId: membership.member_id,
      details: {
        changed_fields: [
          ...Object.keys(userUpdates),
          ...Object.keys(profileUpdates).filter((field) => field !== 'member_id' && field !== 'updated_at'),
        ],
      },
    });

    const { data: updatedMembership, error: resultError } = await supabase
      .from('gym_memberships')
      .select(`
        id,
        gym_id,
        member_id,
        membership_type,
        plan_id,
        price,
        start_date,
        end_date,
        status,
        auto_renew,
        sessions_remaining,
        frozen_at,
        household_id,
        member:users!gym_memberships_member_id_fkey(id, full_name, email, phone, avatar_url, created_at),
        profile:member_profiles!member_profiles_member_id_fkey(member_id, emergency_contact_name, emergency_contact_phone, medical_notes, goals, tags, date_of_birth, address)
      `)
      .eq('id', membershipId)
      .single();
    if (resultError) throw new Error(`Member changes were saved, but the updated record could not be reloaded: ${resultError.message}`);
    return NextResponse.json({ success: true, membership: updatedMembership });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update member record.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
