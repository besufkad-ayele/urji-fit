import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view your profile.' }, { status: 401 });
    const supabase = getSupabaseAdmin();
    const [{ data: profile, error: profileError }, { data: account, error: accountError }] = await Promise.all([
      supabase.from('member_profiles').select('*').eq('member_id', user.id).maybeSingle(),
      supabase.from('users').select('id, full_name, email, phone, avatar_url').eq('id', user.id).single(),
    ]);
    if (profileError) throw new Error(`Failed to load member profile: ${profileError.message}`);
    if (accountError) throw new Error(`Failed to load member contact details: ${accountError.message}`);
    return NextResponse.json({ profile, account });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load member profile.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin profile changes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to update your profile.' }, { status: 401 });
    if (user.role !== 'member') return NextResponse.json({ error: 'Only member accounts can update member profiles.' }, { status: 403 });

    const body: unknown = await request.json();
    if (!isRecord(body)) return NextResponse.json({ error: 'Profile data must be an object.' }, { status: 400 });
    const fields = ['emergency_contact_name', 'emergency_contact_phone', 'medical_notes', 'goals', 'address', 'date_of_birth'] as const;
    const updates: Record<string, unknown> = { member_id: user.id, updated_at: new Date().toISOString() };
    const accountUpdates: Record<string, string | null> = {};

    if ('full_name' in body) {
      if (typeof body.full_name !== 'string' || !body.full_name.trim() || body.full_name.trim().length > 120) {
        return NextResponse.json({ error: 'Name is required and must be 120 characters or fewer.' }, { status: 400 });
      }
      accountUpdates.full_name = body.full_name.trim();
    }
    if ('email' in body) {
      if (body.email !== null && (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))) {
        return NextResponse.json({ error: 'Enter a valid email address or leave it blank.' }, { status: 400 });
      }
      accountUpdates.email = typeof body.email === 'string' ? body.email.trim().toLowerCase() || null : null;
    }
    if ('phone' in body) {
      if (body.phone !== null && (typeof body.phone !== 'string' || body.phone.length > 40)) {
        return NextResponse.json({ error: 'Phone must be 40 characters or fewer.' }, { status: 400 });
      }
      accountUpdates.phone = typeof body.phone === 'string' ? body.phone.trim() || null : null;
    }
    if ('avatar_url' in body) {
      if (body.avatar_url !== null && (typeof body.avatar_url !== 'string' || body.avatar_url.length > 2048 || !/^https?:\/\//i.test(body.avatar_url.trim()))) {
        return NextResponse.json({ error: 'Photo URL must be an HTTP or HTTPS URL.' }, { status: 400 });
      }
      accountUpdates.avatar_url = typeof body.avatar_url === 'string' ? body.avatar_url.trim() || null : null;
    }

    for (const field of fields) {
      if (!(field in body)) continue;
      const value = body[field];
      const limit = ['medical_notes', 'goals', 'address'].includes(field) ? 3000 : 120;
      if (value !== null && (typeof value !== 'string' || value.length > limit)) {
        return NextResponse.json({ error: `${field.replaceAll('_', ' ')} must be ${limit} characters or fewer.` }, { status: 400 });
      }
      if (
        field === 'date_of_birth' &&
        typeof value === 'string' &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) ||
          new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value)
      ) {
        return NextResponse.json({ error: 'Date of birth must use YYYY-MM-DD format.' }, { status: 400 });
      }
      updates[field] = typeof value === 'string' ? value.trim() || null : null;
    }
    if ('tags' in body) {
      if (!Array.isArray(body.tags) || body.tags.length > 20 || body.tags.some((tag) => typeof tag !== 'string' || tag.length > 40)) {
        return NextResponse.json({ error: 'Tags must be a list of up to 20 short text labels.' }, { status: 400 });
      }
      updates.tags = [...new Set(body.tags.map((tag: string) => tag.trim()).filter(Boolean))];
    }
    if (Object.keys(updates).length === 2 && Object.keys(accountUpdates).length === 0) {
      return NextResponse.json({ error: 'No profile changes were provided.' }, { status: 400 });
    }

    if (Object.keys(accountUpdates).length) {
      const { error: accountError } = await getSupabaseAdmin()
        .from('users')
        .update({ ...accountUpdates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .eq('role', 'member');
      if (accountError) {
        if (accountError.code === '23505') return NextResponse.json({ error: 'That email or phone number is already assigned to another account.' }, { status: 409 });
        throw new Error(`Failed to update account contact details: ${accountError.message}`);
      }
    }

    let profile = null;
    if (Object.keys(updates).length > 2) {
      const { data, error } = await getSupabaseAdmin()
        .from('member_profiles')
        .upsert(updates, { onConflict: 'member_id' })
        .select('*')
        .single();
      if (error) throw new Error(`Failed to update member profile: ${error.message}`);
      profile = data;
    } else {
      const { data, error } = await getSupabaseAdmin()
        .from('member_profiles')
        .select('*')
        .eq('member_id', user.id)
        .maybeSingle();
      if (error) throw new Error(`Account updated, but the profile could not be reloaded: ${error.message}`);
      profile = data;
    }
    const { data: account, error: accountError } = await getSupabaseAdmin()
      .from('users')
      .select('id, full_name, email, phone, avatar_url')
      .eq('id', user.id)
      .single();
    if (accountError) throw new Error(`Profile was updated, but account details could not be reloaded: ${accountError.message}`);
    const changedFields = [
      ...Object.keys(accountUpdates),
      ...Object.keys(updates).filter((field) => field !== 'member_id' && field !== 'updated_at'),
    ];
    if (changedFields.length) {
      const { data: memberships, error: membershipsError } = await getSupabaseAdmin()
        .from('gym_memberships')
        .select('gym_id')
        .eq('member_id', user.id);
      if (membershipsError) throw new Error(`Profile was updated, but gym audit records could not be prepared: ${membershipsError.message}`);
      const gymIds = [...new Set((memberships ?? []).map((membership) => membership.gym_id))];
      if (gymIds.length) {
        const { error: auditError } = await getSupabaseAdmin().from('gym_audit_logs').insert(
          gymIds.map((gymId) => ({
            gym_id: gymId,
            actor_id: user.id,
            action: 'member_profile_updated',
            target_type: 'member',
            target_id: user.id,
            details: { changed_fields: changedFields },
          }))
        );
        if (auditError) throw new Error(`Profile was updated, but its gym audit records could not be saved: ${auditError.message}`);
      }
    }
    return NextResponse.json({ success: true, profile, account });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update member profile.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
