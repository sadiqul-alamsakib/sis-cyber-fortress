import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile } from '@/types/security';

export async function recordAuditLog(
  supabase: SupabaseClient,
  actor: UserProfile,
  params: {
    module_slug: string;
    action: string;
    resource_type: string;
    resource_id?: string | null;
    details?: Record<string, unknown>;
  }
) {
  await supabase.from('audit_logs').insert({
    actor_id: actor.id,
    actor_email: actor.email,
    actor_role: actor.role,
    module_slug: params.module_slug,
    action: params.action,
    resource_type: params.resource_type,
    resource_id: params.resource_id ?? null,
    details: params.details ?? {},
  });
}
