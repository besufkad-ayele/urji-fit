import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Sign in to view managed gyms.' }, { status: 401 });
    const supabase = getSupabaseAdmin();
    if (user.role === 'admin' || user.role === 'platform_admin') {
      const { data, error } = await supabase.from('gyms').select('id, name').order('name').limit(1000);
      if (error) throw new Error(`Failed to load gyms: ${error.message}`);
      return NextResponse.json({ gyms: data ?? [] });
    }
    if (user.role === 'gym_owner') {
      const { data, error } = await supabase.from('gyms').select('id, name').eq('owner_id', user.id).order('name').limit(1000);
      if (error) throw new Error(`Failed to load gyms: ${error.message}`);
      return NextResponse.json({ gyms: data ?? [] });
    }
    const { data: staff, error: staffError } = await supabase
      .from('gym_staff')
      .select('gym_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .eq('position', 'manager');
    if (staffError) throw new Error(`Failed to load manager assignments: ${staffError.message}`);
    const gymIds = [...new Set((staff ?? []).map((record) => record.gym_id))];
    if (!gymIds.length) return NextResponse.json({ gyms: [] });
    const { data, error } = await supabase.from('gyms').select('id, name').in('id', gymIds).order('name');
    if (error) throw new Error(`Failed to load managed gyms: ${error.message}`);
    return NextResponse.json({ gyms: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load managed gyms.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
