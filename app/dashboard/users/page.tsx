import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth/session-guard';
import DashboardShell from '@/components/dashboard/DashboardShell';
import UsersClient from '@/components/admin/UsersClient';
import type { UserProfile } from '@/types/security';

async function UsersContent() {
  const { supabase, profile } = await requireDashboardSession();

  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, created_at')
    .order('created_at', { ascending: false });

  const users = (data ?? [profile]) as UserProfile[];

  return (
    <DashboardShell
      profile={profile}
      title="User Management & RBAC"
      subtitle="Assign Super Admin, Security Admin, Module Admin, Auditor, and Viewer permissions"
    >
      <UsersClient currentProfile={profile} initialUsers={users} />
    </DashboardShell>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07080b]" />}>
      <UsersContent />
    </Suspense>
  );
}
