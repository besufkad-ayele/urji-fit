import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view classes.' }, { status: 401 });
    if (user.role !== 'member') return NextResponse.json({ error: 'Only members can view the member class schedule.' }, { status: 403 });

    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const { data: memberships, error: membershipError } = await supabase
      .from('gym_memberships')
      .select('gym_id')
      .eq('member_id', user.id)
      .eq('status', 'active')
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`);
    if (membershipError) throw new Error(`Failed to load active memberships: ${membershipError.message}`);

    const gymIds = [...new Set((memberships ?? []).map((membership) => membership.gym_id))];
    if (gymIds.length === 0) return NextResponse.json({ classes: [] });

    const { data: gyms, error: gymsError } = await supabase
      .from('gyms')
      .select('id, name')
      .in('id', gymIds);
    if (gymsError) throw new Error(`Failed to load member gyms: ${gymsError.message}`);
    const gymNames = new Map((gyms ?? []).map((gym) => [gym.id, gym.name]));

    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select('*, trainer:users!classes_trainer_id_fkey(id, full_name, avatar_url)')
      .in('gym_id', gymIds)
      .eq('status', 'active')
      .order('day_of_week')
      .order('start_time');
    if (classesError) throw new Error(`Failed to load class schedule: ${classesError.message}`);

    return NextResponse.json({
      classes: (classes ?? []).map((gymClass) => ({
        ...gymClass,
        gym_name: gymNames.get(gymClass.gym_id) ?? 'Gym',
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load classes.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
