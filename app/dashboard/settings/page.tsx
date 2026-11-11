import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth/session-guard';
import DashboardShell from '@/components/dashboard/DashboardShell';
import SettingsClient from '@/components/admin/SettingsClient';

async function SettingsContent() {
  const { profile } = await requireDashboardSession();

  return (
    <DashboardShell
      profile={profile}
      title="System Settings & API Health"
      subtitle="Live PostgreSQL integration status, latency telemetry & security posture"
    >
      <SettingsClient />
    </DashboardShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07080b]" />}>
      <SettingsContent />
    </Suspense>
  );
}
