import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
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

export async function getAuthenticatedProfile(request?: Request): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  profile: UserProfile | null;
}> {
  const authHeader = request?.headers.get('authorization');
  const bearerToken =
    authHeader && authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null;

  // Support Android / mobile REST clients sending Authorization: Bearer <access_token>
  if (bearerToken) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const tokenClient = createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error,
    } = await tokenClient.auth.getUser(bearerToken);

    if (error || !user) {
      return {
        supabase: tokenClient as unknown as Awaited<ReturnType<typeof createClient>>,
        profile: null,
      };
    }

    const { data: profileRow } = await tokenClient
      .from('profiles')
      .select('id, email, full_name, avatar_url, role, created_at')
      .eq('id', user.id)
      .maybeSingle();

    const metadata = user.user_metadata ?? {};
    const role: UserRole = isValidRole(profileRow?.role) ? profileRow.role : 'viewer';

    return {
      supabase: tokenClient as unknown as Awaited<ReturnType<typeof createClient>>,
      profile: {
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
      },
    };
  }

  // Standard Web Cookie SSR Authentication
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
