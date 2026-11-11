import { NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import { getAuthenticatedProfile } from '@/lib/auth/rbac';
import { recordAuditLog } from '@/lib/audit';
import { analyzePhishingUrl, classifyPhishingRisk } from '@/lib/security/analyzers';

export async function GET() {
  const { supabase, profile } = await getAuthenticatedProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('phishing_scans')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scans: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    url?: string;
    reportThreat?: boolean;
  } | null;

  if (!body?.url?.trim()) {
    return NextResponse.json({ error: 'Target URL is required.' }, { status: 400 });
  }

  let analysis;
  try {
    analysis = analyzePhishingUrl(body.url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format.' }, { status: 400 });
  }

  const { parsedUrl: parsed, hostname, findings } = analysis;
  let riskScore = analysis.baseRiskScore;

  let dnsResolved = false;
  try {
    const addresses = await dns.resolve4(hostname);
    dnsResolved = addresses.length > 0;
  } catch {
    riskScore += 10;
    findings.push('Domain failed live DNS A-record resolution');
  }

  const { data: matchedIocs } = await supabase
    .from('threat_iocs')
    .select('indicator, severity, source_feed')
    .eq('is_active', true)
    .in('indicator', [hostname, parsed.href]);

  if (matchedIocs && matchedIocs.length > 0) {
    riskScore += 45;
    findings.push(
      `Matched active Threat Intelligence IOC (${matchedIocs[0].source_feed}: ${matchedIocs[0].severity})`
    );
  }

  riskScore = Math.min(100, riskScore);
  const verdict = classifyPhishingRisk(riskScore);

  if (findings.length === 0) {
    findings.push('No heuristic, DNS, or Threat IOC anomalies detected');
  }

  const { data: scanRow, error } = await supabase
    .from('phishing_scans')
    .insert({
      submitted_by: profile.id,
      target_url: parsed.href,
      hostname,
      risk_score: riskScore,
      verdict,
      findings,
      dns_resolved: dnsResolved,
      is_reported_threat: Boolean(body.reportThreat || verdict === 'malicious'),
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (verdict === 'malicious' || body.reportThreat) {
    await supabase.from('security_logs').insert({
      source_ip: 'web-phishing-scanner',
      event_type: 'PHISHING_URL_FLAGGED',
      message: `URL ${parsed.href} scored ${riskScore}/100 (${verdict})`,
      target_node: hostname,
      status: verdict === 'malicious' ? 'Critical' : 'Warning',
      is_resolved: false,
    });
  }

  await recordAuditLog(supabase, profile, {
    module_slug: '02-phishing-shield',
    action: 'PHISHING_URL_SCANNED',
    resource_type: 'phishing_scans',
    resource_id: scanRow.id,
    details: { hostname, riskScore, verdict },
  });

  return NextResponse.json({ scan: scanRow }, { status: 201 });
}
