import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/trainer/progress-notes - Get progress notes for a client
export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const trainerId = searchParams.get('trainerId');

    if (!clientId || !trainerId) {
      return NextResponse.json(
        { error: 'Client ID and trainer ID are required' },
        { status: 400 }
      );
    }

    const { data: notes, error } = await supabaseAdmin
      .from('progress_notes')
      .select(`
        *,
        trainer:users!progress_notes_trainer_id_fkey(id, full_name),
        client:users!progress_notes_client_id_fkey(id, full_name)
      `)
      .eq('client_id', clientId)
      .eq('trainer_id', trainerId)
      .order('note_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/trainer/progress-notes - Create progress note
export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();
    const {
      trainer_id,
      client_id,
      gym_id,
      note_type,
      content,
      measurements,
      photos,
      is_private = false,
    } = body;

    if (!trainer_id || !client_id || !content) {
      return NextResponse.json(
        { error: 'Trainer ID, client ID, and content are required' },
        { status: 400 }
      );
    }

    const { data: note, error } = await supabaseAdmin
      .from('progress_notes')
      .insert({
        trainer_id,
        client_id,
        gym_id,
        note_date: new Date().toISOString().split('T')[0],
        note_type,
        content,
        measurements,
        photos,
        is_private,
      })
      .select(`
        *,
        trainer:users!progress_notes_trainer_id_fkey(id, full_name),
        client:users!progress_notes_client_id_fkey(id, full_name)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, note });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
