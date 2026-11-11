import { NextResponse } from 'next/server';
import { getAuthenticatedProfile } from '@/lib/auth/rbac';

export async function GET() {
  const { supabase, profile } = await getAuthenticatedProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();

  const [
    profilesRes,
    assetsRes,
    logsRes,
    incidentsRes,
    phishingRes,
    webshieldRes,
    iocsRes,
    forensicsRes,
    backupsRes,
    auditRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('authorized_assets').select('id', { count: 'exact', head: true }),
    supabase.from('security_logs').select('id', { count: 'exact', head: true }),
    supabase.from('soc_incidents').select('id', { count: 'exact', head: true }),
    supabase.from('phishing_scans').select('id', { count: 'exact', head: true }),
    supabase.from('webshield_scans').select('id', { count: 'exact', head: true }),
    supabase.from('threat_iocs').select('id', { count: 'exact', head: true }),
    supabase.from('forensics_cases').select('id', { count: 'exact', head: true }),
    supabase.from('backup_policies').select('id', { count: 'exact', head: true }),
    supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
  ]);

  const dbLatencyMs = Date.now() - startedAt;
  const dbHealthy = !profilesRes.error && !logsRes.error;

  return NextResponse.json({
    status: dbHealthy ? 'operational' : 'degraded',
    checkedAt: new Date().toISOString(),
    dbLatencyMs,
    supabaseProject: 'fgblxhexydgwpltmxros',
    counts: {
      profiles: profilesRes.count ?? 0,
      authorized_assets: assetsRes.count ?? 0,
      security_logs: logsRes.count ?? 0,
      soc_incidents: incidentsRes.count ?? 0,
      phishing_scans: phishingRes.count ?? 0,
      webshield_scans: webshieldRes.count ?? 0,
      threat_iocs: iocsRes.count ?? 0,
      forensics_cases: forensicsRes.count ?? 0,
      backup_policies: backupsRes.count ?? 0,
      audit_logs: auditRes.count ?? 0,
    },
  });
}
