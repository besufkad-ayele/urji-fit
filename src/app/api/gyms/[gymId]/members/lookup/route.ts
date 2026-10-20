import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin member lookups are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to look up a member account.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'Only gym owners and managers can look up member accounts.' }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Provide a member phone number or email.' }, { status: 400 });
    }
    const email = 'email' in body && typeof body.email === 'string' ? body.email.trim() : '';
    const phone = 'phone' in body && typeof body.phone === 'string' ? body.phone.trim() : '';
    if ((!email && !phone) || (email && phone)) {
      return NextResponse.json({ error: 'Provide exactly one contact method to find the admin-created member account.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const accounts = new Map<string, { id: string; full_name: string; email: string | null; phone: string | null }>();
    if (email) {
      for (const candidateEmail of new Set([email, email.toLowerCase()])) {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email, phone')
          .eq('role', 'member')
          .eq('email', candidateEmail)
          .limit(2);
        if (error) throw new Error(`Failed to look up the member account: ${error.message}`);
        for (const account of data ?? []) accounts.set(account.id, account);
      }
    } else {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, phone')
        .eq('role', 'member')
        .eq('phone', phone)
        .limit(2);
      if (error) throw new Error(`Failed to look up the member account: ${error.message}`);
      for (const account of data ?? []) accounts.set(account.id, account);
    }

    if (accounts.size === 0) return NextResponse.json({ error: 'No member account matched that exact contact. Ask an administrator to create it first.' }, { status: 404 });
    if (accounts.size > 1) return NextResponse.json({ error: 'More than one account matched. Resolve duplicate contact details before enrolling.' }, { status: 409 });
    const account = [...accounts.values()][0];
    const { data: currentMembership, error: membershipError } = await supabase
      .from('gym_memberships')
      .select('id')
      .eq('gym_id', gymId)
      .eq('member_id', account.id)
      .in('status', ['active', 'suspended'])
      .or(`end_date.is.null,end_date.gte.${new Date().toISOString().slice(0, 10)}`)
      .maybeSingle();
    if (membershipError) throw new Error(`Member was found, but existing gym memberships could not be checked: ${membershipError.message}`);
    if (currentMembership) return NextResponse.json({ error: 'This account already has a current membership at this gym.' }, { status: 409 });

    return NextResponse.json({ member: account });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to look up member account.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
