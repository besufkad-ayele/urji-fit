import { NextRequest, NextResponse } from 'next/server';
import { canConfigureGymPayments, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

const PAYMENT_FIELDS = [
  'bank_name',
  'bank_account_name',
  'bank_account_number',
  'mobile_money_provider',
  'mobile_money_account',
  'payment_instructions',
] as const;

type PaymentSettings = Partial<Record<(typeof PAYMENT_FIELDS)[number], string | null>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to view payment settings.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to manage this gym.' }, { status: 403 });
    }

    const { data: gym, error } = await getSupabaseAdmin()
      .from('gyms')
      .select(`id, ${PAYMENT_FIELDS.join(', ')}`)
      .eq('id', gymId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load payment settings: ${error.message}`);
    if (!gym) return NextResponse.json({ error: 'Gym not found.' }, { status: 404 });
    return NextResponse.json({ settings: gym });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load payment settings.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin payment settings changes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Sign in to update payment settings.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canConfigureGymPayments(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to manage this gym.' }, { status: 403 });
    }

    const body: unknown = await req.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Payment settings must be an object.' }, { status: 400 });
    }

    const updates: PaymentSettings = {};
    for (const field of PAYMENT_FIELDS) {
      if (!(field in body)) continue;
      const value = body[field];
      if (value !== null && typeof value !== 'string') {
        return NextResponse.json({ error: `${field.replaceAll('_', ' ')} must be text.` }, { status: 400 });
      }
      if (typeof value === 'string' && value.length > 500) {
        return NextResponse.json({ error: `${field.replaceAll('_', ' ')} must be 500 characters or fewer.` }, { status: 400 });
      }
      updates[field] = typeof value === 'string' ? value.trim() || null : value;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No payment settings were provided.' }, { status: 400 });
    }

    const { data: gym, error } = await getSupabaseAdmin()
      .from('gyms')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', gymId)
      .select(`id, ${PAYMENT_FIELDS.join(', ')}`)
      .maybeSingle();
    if (error) throw new Error(`Failed to save payment settings: ${error.message}`);
    if (!gym) return NextResponse.json({ error: 'Gym not found.' }, { status: 404 });
    return NextResponse.json({ success: true, settings: gym });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save payment settings.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
