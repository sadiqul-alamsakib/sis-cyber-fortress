import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth/session-guard';
import DashboardShell from '@/components/dashboard/DashboardShell';
import UnifiedControlClient from '@/components/admin/UnifiedControlClient';
import type {
  AuthorizedAsset,
  DeviceCommand,
  SecurityPolicy,
} from '@/types/security';

async function UnifiedControlContent() {
  const { supabase, profile } = await requireDashboardSession();

  const [assetsRes, commandsRes, policiesRes] = await Promise.all([
    supabase
      .from('authorized_assets')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('device_commands')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('security_policies')
      .select('*')
      .order('policy_key', { ascending: true }),
  ]);

  return (
    <DashboardShell
      profile={profile}
      title="Unified App & Website Control Plane"
      subtitle="Orchestrate global policies, dispatch real-time Android app commands & trigger authorized website scans"
    >
      <UnifiedControlClient
        profile={profile}
        initialAssets={(assetsRes.data ?? []) as AuthorizedAsset[]}
        initialCommands={(commandsRes.data ?? []) as DeviceCommand[]}
        initialPolicies={(policiesRes.data ?? []) as SecurityPolicy[]}
      />
    </DashboardShell>
  );
}

export default function UnifiedControlPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07080b]" />}>
      <UnifiedControlContent />
    </Suspense>
  );
}
