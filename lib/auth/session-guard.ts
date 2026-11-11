import { redirect } from 'next/navigation';
import { getAuthenticatedProfile } from './rbac';

export async function requireDashboardSession() {
  const { supabase, profile } = await getAuthenticatedProfile();
  if (!profile) {
    redirect('/login');
  }
  return { supabase, profile };
}
