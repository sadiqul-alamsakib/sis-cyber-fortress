import { createClient } from '@/lib/supabase/server';
import type { UserProfile, UserRole } from '@/types/security';
import {
  canManageSecurityOps,
  getRoleLabel,
  isReadOnlyRole,
  isSuperAdmin,
  isValidRole,
} from './roles';

export {
  canManageSecurityOps,
  getRoleLabel,
  isReadOnlyRole,
  isSuperAdmin,
  isValidRole,
};

export async function getAuthenticatedProfile(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  profile: UserProfile | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, profile: null };
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, created_at')
    .eq('id', user.id)
    .maybeSingle();

  const metadata = user.user_metadata ?? {};
  const role: UserRole = isValidRole(profileRow?.role) ? profileRow.role : 'viewer';

  const profile: UserProfile = {
    id: user.id,
    email: profileRow?.email ?? user.email ?? 'operator@sis-fortress.local',
    full_name:
      profileRow?.full_name ??
      (typeof metadata.full_name === 'string' ? metadata.full_name : null) ??
      (typeof metadata.name === 'string' ? metadata.name : null),
    avatar_url:
      profileRow?.avatar_url ??
      (typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null) ??
      (typeof metadata.picture === 'string' ? metadata.picture : null),
    role,
    created_at: profileRow?.created_at,
  };

  return { supabase, profile };
}
