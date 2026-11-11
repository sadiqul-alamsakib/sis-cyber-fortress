import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth/session-guard';
import DashboardClient, { type OverviewRealStats } from '@/components/dashboard/DashboardClient';
import type { SecurityLog } from '@/types/security';

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#07080b] bg-tactical-grid text-zinc-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        <p className="text-xs font-mono tracking-widest uppercase text-zinc-400">
          Loading Live PostgreSQL Telemetry...
        </p>
      </div>
    </div>
  );
}

async function DashboardContent() {
  const { supabase, profile } = await requireDashboardSession();

  const [
    logsRes,
    assetsRes,
    incidentsRes,
    phishingRes,
    webshieldRes,
    iocsRes,
    backupsRes,
    forensicsRes,
    auditRes,
    networkRes,
    loginRes,
    vaultRes,
    profilesRes,
  ] = await Promise.all([
    supabase
      .from('security_logs')
      .select('id, created_at, source_ip, event_type, message, target_node, status, is_resolved, resolved_by, metadata')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('authorized_assets').select('id, asset_type, compliance_status'),
    supabase.from('soc_incidents').select('id, status'),
    supabase.from('phishing_scans').select('id', { count: 'exact', head: true }),
    supabase.from('webshield_scans').select('id', { count: 'exact', head: true }),
    supabase.from('threat_iocs').select('id, is_active'),
    supabase.from('backup_policies').select('id, status'),
    supabase.from('forensics_cases').select('id', { count: 'exact', head: true }),
    supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
    supabase.from('network_assessments').select('id', { count: 'exact', head: true }),
    supabase.from('login_activities').select('id', { count: 'exact', head: true }),
    supabase.from('vault_items').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ]);

  const assets = assetsRes.data ?? [];
  const incidents = incidentsRes.data ?? [];
  const iocs = iocsRes.data ?? [];
  const backups = backupsRes.data ?? [];

  const androidAndServers = assets.filter(
    (a) => a.asset_type === 'android_device' || a.asset_type === 'server_node'
  ).length;
  const phishingCount = phishingRes.count ?? 0;
  const webshieldCount = webshieldRes.count ?? 0;
  const forensicsCount = forensicsRes.count ?? 0;
  const auditCount = auditRes.count ?? 0;
  const networkCount = networkRes.count ?? 0;
  const loginCount = loginRes.count ?? 0;
  const vaultCount = vaultRes.count ?? 0;
  const profilesCount = profilesRes.count ?? 0;

  const stats: OverviewRealStats = {
    totalAssets: assets.length,
    compliantAssets: assets.filter((a) => a.compliance_status === 'compliant').length,
    openIncidents: incidents.filter((i) => i.status !== 'resolved').length,
    totalScans: phishingCount + webshieldCount,
    activeIocs: iocs.filter((i) => i.is_active).length,
    auditCount,
    backupHealthy: backups.filter((b) => b.status === 'healthy').length,
    backupTotal: backups.length,
    forensicsCases: forensicsCount,
    moduleActivityCounts: {
      '01-identity-guardian': loginCount,
      '02-phishing-shield': phishingCount,
      '03-endpoint-guardian': androidAndServers,
      '04-network-sentinel': networkCount,
      '05-vault-guardian': vaultCount,
      '06-ransomware-guardian': backups.length,
      '07-webshield': webshieldCount,
      '08-digital-forensics': forensicsCount,
      '09-access-guardian': profilesCount,
      '10-threat-intelligence': iocs.length,
      '11-cloud-backup-guardian': backups.length,
      '12-cyber-soc': incidents.length + (logsRes.data?.length ?? 0),
    },
  };

  const initialLogs: SecurityLog[] =
    !logsRes.error && Array.isArray(logsRes.data) ? (logsRes.data as SecurityLog[]) : [];

  return (
    <DashboardClient
      profile={profile}
      initialLogs={initialLogs}
      stats={stats}
      dbConnected={!logsRes.error}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
