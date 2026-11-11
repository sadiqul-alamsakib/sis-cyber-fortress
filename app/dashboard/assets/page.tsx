import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth/session-guard';
import DashboardShell from '@/components/dashboard/DashboardShell';
import AssetsClient from '@/components/admin/AssetsClient';
import type { AuthorizedAsset } from '@/types/security';

async function AssetsContent() {
  const { supabase, profile } = await requireDashboardSession();

  const { data } = await supabase
    .from('authorized_assets')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <DashboardShell
      profile={profile}
      title="Authorized Asset & Device Registry"
      subtitle="Approved websites, Android endpoints, server nodes & Wi-Fi APs eligible for authorized security scanning"
    >
      <AssetsClient profile={profile} initialAssets={(data ?? []) as AuthorizedAsset[]} />
    </DashboardShell>
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07080b]" />}>
      <AssetsContent />
    </Suspense>
  );
}
