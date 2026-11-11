import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth/session-guard';
import DashboardShell from '@/components/dashboard/DashboardShell';
import ForensicsThreatSocPanel from '@/components/modules/panels/ForensicsThreatSocPanel';

async function IncidentsContent() {
  const { profile } = await requireDashboardSession();

  return (
    <DashboardShell
      profile={profile}
      title="SOC Alerts & Incident Management"
      subtitle="Unified incident triage, severity prioritization & containment workflow"
    >
      <ForensicsThreatSocPanel slug="12-cyber-soc" />
    </DashboardShell>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07080b]" />}>
      <IncidentsContent />
    </Suspense>
  );
}
