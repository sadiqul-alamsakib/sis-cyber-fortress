import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth/session-guard';
import DashboardShell from '@/components/dashboard/DashboardShell';
import ReportsClient, { type AnalyticsSummary } from '@/components/admin/ReportsClient';

async function ReportsContent() {
  const { supabase, profile } = await requireDashboardSession();

  const [logsRes, phishingRes, webRes, assetsRes, iocsRes, casesRes, auditRes, backupsRes] =
    await Promise.all([
      supabase.from('security_logs').select('status'),
      supabase.from('phishing_scans').select('verdict'),
      supabase.from('webshield_scans').select('security_score'),
      supabase.from('authorized_assets').select('id', { count: 'exact', head: true }),
      supabase.from('threat_iocs').select('id', { count: 'exact', head: true }),
      supabase.from('forensics_cases').select('id', { count: 'exact', head: true }),
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
      supabase.from('backup_policies').select('id', { count: 'exact', head: true }),
    ]);

  const logs = logsRes.data ?? [];
  const phishing = phishingRes.data ?? [];
  const webScans = webRes.data ?? [];

  const avgWebShieldScore =
    webScans.length > 0
      ? Math.round(
          webScans.reduce((acc, s) => acc + (Number(s.security_score) || 0), 0) /
            webScans.length
        )
      : null;

  const summary: AnalyticsSummary = {
    generatedAt: new Date().toISOString(),
    severityBreakdown: [
      {
        label: 'Critical',
        count: logs.filter((l) => l.status === 'Critical').length,
        color: 'bg-rose-500',
      },
      {
        label: 'Warning',
        count: logs.filter((l) => l.status === 'Warning').length,
        color: 'bg-amber-400',
      },
      {
        label: 'Secure',
        count: logs.filter((l) => l.status === 'Secure').length,
        color: 'bg-teal-400',
      },
    ],
    phishingVerdicts: {
      safe: phishing.filter((p) => p.verdict === 'safe').length,
      suspicious: phishing.filter((p) => p.verdict === 'suspicious').length,
      malicious: phishing.filter((p) => p.verdict === 'malicious').length,
    },
    avgWebShieldScore,
    moduleMetrics: [
      { module: 'Authorized Assets', count: assetsRes.count ?? 0 },
      { module: 'Threat Intelligence IOCs', count: iocsRes.count ?? 0 },
      { module: 'Phishing Scans', count: phishing.length },
      { module: 'WebShield Scans', count: webScans.length },
      { module: 'Forensics Cases', count: casesRes.count ?? 0 },
      { module: 'Backup Policies', count: backupsRes.count ?? 0 },
      { module: 'Audit Log Trail', count: auditRes.count ?? 0 },
    ],
  };

  return (
    <DashboardShell
      profile={profile}
      title="Reports & Analytics"
      subtitle="Live database-computed security posture, scan telemetry & compliance exports"
    >
      <ReportsClient summary={summary} />
    </DashboardShell>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07080b]" />}>
      <ReportsContent />
    </Suspense>
  );
}
