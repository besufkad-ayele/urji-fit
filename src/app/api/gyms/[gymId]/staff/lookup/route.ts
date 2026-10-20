import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin staff lookups are not allowed.' }, { status: 403 });
  }

  try {
    const actor = await getAuthenticatedUser(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to find staff accounts.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(actor, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to manage staff for this gym.' }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Provide an email address or phone number.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const email = typeof input.email === 'string' ? input.email.trim() : '';
    const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
    const position = input.position;
    if ((!email && !phone) || (email && phone)) {
      return NextResponse.json({ error: 'Provide exactly one email address or phone number.' }, { status: 400 });
    }
    if (typeof position !== 'string' || !['trainer', 'head_trainer', 'receptionist', 'manager', 'maintenance'].includes(position)) {
      return NextResponse.json({ error: 'Choose a valid staff position before looking up an account.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const query = supabase
      .from('users')
      .select('id, full_name, email, phone, role')
      .limit(2);
    const { data: accounts, error } = email
      ? await query.eq('email', email.toLowerCase()).in('role', position === 'trainer' || position === 'head_trainer' ? ['trainer'] : ['trainer', 'member'])
      : await query.eq('phone', phone).in('role', position === 'trainer' || position === 'head_trainer' ? ['trainer'] : ['trainer', 'member']);
    if (error) throw new Error(`Failed to look up the staff account: ${error.message}`);
    if (!accounts?.length) {
      const message = position === 'trainer' || position === 'head_trainer'
        ? 'No trainer account matched that contact. Ask an administrator to create the trainer account first.'
        : 'No eligible account matched that contact. Ask an administrator to create it first.';
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (accounts.length > 1) {
      return NextResponse.json({ error: 'More than one account matched. Resolve duplicate contact details before assigning staff.' }, { status: 409 });
    }

    const account = accounts[0];
    const { data: existingStaff, error: staffError } = await supabase
      .from('gym_staff')
      .select('id, status')
      .eq('gym_id', gymId)
      .eq('user_id', account.id)
      .maybeSingle();
    if (staffError) throw new Error(`Could not check the current gym staff list: ${staffError.message}`);
    if (existingStaff) {
      const message = existingStaff.status === 'terminated'
        ? 'This account has a terminated staff record. Edit that record in the staff list to reactivate it.'
        : 'This account is already assigned to the gym.';
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ account: { id: account.id, full_name: account.full_name, email: account.email, phone: account.phone } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to look up a staff account.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
