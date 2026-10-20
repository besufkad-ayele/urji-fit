import { NextRequest, NextResponse } from 'next/server';
import { canManageGym, getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin POS sales are not allowed.' }, { status: 403 });
  }
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to record a sale.' }, { status: 401 });
    const { gymId } = await params;
    if (!(await canManageGym(user, gymId))) {
      return NextResponse.json({ error: 'You are not authorized to use this gym POS.' }, { status: 403 });
    }
    const body: unknown = await request.json();
    if (!isRecord(body) || !Array.isArray(body.items)) {
      return NextResponse.json({ error: 'A list of sale items is required.' }, { status: 400 });
    }
    if (body.member_id !== undefined && body.member_id !== null && typeof body.member_id !== 'string') {
      return NextResponse.json({ error: 'Member ID must be a valid member account.' }, { status: 400 });
    }
    const products: Array<{ product_id: string; quantity: number }> = [];
    for (const item of body.items) {
      if (!isRecord(item) || typeof item.product_id !== 'string' || !Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 10000) {
        return NextResponse.json({ error: 'Each line requires a product ID and whole-number quantity.' }, { status: 400 });
      }
      products.push({ product_id: item.product_id, quantity: Number(item.quantity) });
    }
    const { data, error } = await getSupabaseAdmin().rpc('record_gym_pos_sale', {
      p_gym_id: gymId,
      p_member_id: typeof body.member_id === 'string' ? body.member_id : null,
      p_actor_id: user.id,
      p_items: products,
    });
    if (error) {
      const status = error.code === 'P0002' ? 404 : error.code === '22023' ? 400 : 500;
      if (status === 500) throw new Error(`Failed to complete POS sale: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status });
    }
    const sale = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ success: true, sale }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete POS sale.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
