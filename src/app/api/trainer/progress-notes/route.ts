import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/trainer/progress-notes - Get progress notes for a client
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user || user.role !== 'trainer') {
      return NextResponse.json({ error: 'A trainer session is required.' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const trainerId = searchParams.get('trainerId');

    if (!clientId || trainerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only view notes for a client assigned to your trainer account.' },
        { status: 403 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('trainer_assignments')
      .select('id')
      .eq('client_id', clientId)
      .eq('trainer_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (assignmentError) {
      return NextResponse.json({ error: `Could not verify client assignment: ${assignmentError.message}` }, { status: 500 });
    }
    if (!assignment) return NextResponse.json({ error: 'This client is not assigned to you.' }, { status: 403 });

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
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin progress notes are not allowed.' }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user || user.role !== 'trainer') {
      return NextResponse.json({ error: 'A trainer session is required.' }, { status: 403 });
    }
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

    if (trainer_id !== user.id || !client_id || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { error: 'You can only write a non-empty progress note as your own trainer account.' },
        { status: 403 }
      );
    }
    if (content.length > 5000) {
      return NextResponse.json({ error: 'Progress notes must be 5,000 characters or fewer.' }, { status: 400 });
    }
    const validNoteTypes = ['assessment', 'progress', 'injury', 'goal_update', 'general'];
    if (note_type !== null && note_type !== undefined && !validNoteTypes.includes(note_type)) {
      return NextResponse.json({ error: 'Choose a valid progress note type.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    let assignmentQuery = supabaseAdmin
      .from('trainer_assignments')
      .select('id')
      .eq('client_id', client_id)
      .eq('trainer_id', user.id)
      .eq('status', 'active');
    if (gym_id) assignmentQuery = assignmentQuery.eq('gym_id', gym_id);
    const { data: assignment, error: assignmentError } = await assignmentQuery.limit(1).maybeSingle();
    if (assignmentError) {
      return NextResponse.json({ error: `Could not verify client assignment: ${assignmentError.message}` }, { status: 500 });
    }
    if (!assignment) return NextResponse.json({ error: 'This client is not assigned to you.' }, { status: 403 });

    const { data: note, error } = await supabaseAdmin
      .from('progress_notes')
      .insert({
        trainer_id,
        client_id,
        gym_id,
        note_date: new Date().toISOString().split('T')[0],
        note_type,
        content: content.trim(),
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
