import { getSupabaseAdmin } from '@/lib/supabase';

export interface GymAuditEvent {
  gymId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
}

export async function recordGymAuditEvent(event: GymAuditEvent): Promise<void> {
  const { error } = await getSupabaseAdmin().from('gym_audit_logs').insert({
    gym_id: event.gymId,
    actor_id: event.actorId,
    action: event.action,
    target_type: event.targetType,
    target_id: event.targetId ?? null,
    details: event.details ?? {},
  });
  if (error) {
    throw new Error(`The change was saved, but its audit entry could not be recorded: ${error.message}`);
  }
}
