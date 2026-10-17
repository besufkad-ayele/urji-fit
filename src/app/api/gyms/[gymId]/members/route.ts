import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/gyms/[gymId]/members - Get all members for a gym
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { gymId } = await params;

    const { data: memberships, error } = await supabaseAdmin
      .from('gym_memberships')
      .select(`
        *,
        member:users!gym_memberships_member_id_fkey(
          id,
          full_name,
          email,
          phone,
          avatar_url,
          created_at
        ),
        trainer_assignments(
          id,
          trainer:users!trainer_assignments_trainer_id_fkey(id, full_name)
        )
      `)
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ memberships });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/gyms/[gymId]/members - Add new member to gym
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gymId: string }> }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { gymId } = await params;
    const body = await req.json();
    const {
      member_id,
      membership_type,
      price,
      start_date,
      end_date,
      auto_renew = true,
    } = body;

    if (!member_id || !membership_type || !price) {
      return NextResponse.json(
        { error: 'Member ID, membership type, and price are required' },
        { status: 400 }
      );
    }

    const { data: membership, error } = await supabaseAdmin
      .from('gym_memberships')
      .insert({
        gym_id: gymId,
        member_id,
        membership_type,
        price,
        start_date: start_date || new Date().toISOString().split('T')[0],
        end_date,
        status: 'active',
        auto_renew,
      })
      .select(`
        *,
        member:users!gym_memberships_member_id_fkey(id, full_name, email, phone)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, membership });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
