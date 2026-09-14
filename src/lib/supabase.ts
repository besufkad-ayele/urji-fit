import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://updmcynrapoaedcenlzk.supabase.co';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwZG1jeW5yYXBvYWVkY2VubHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTEzODksImV4cCI6MjEwNDg2NzM4OX0.Y-kx22l4F1Zx4GB8WfDKLtOJoBqxP0Pckh-uJ-I1PVs';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwZG1jeW5yYXBvYWVkY2VubHprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTI5MTM4OSwiZXhwIjoyMTA0ODY3Mzg5fQ.qHiINys5vgU75zx6U_3u4QZiaMUF3HBc9hgdW3g0dfI';

// Client-side Supabase instance
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Server-side Admin instance with full bypass privileges
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});
