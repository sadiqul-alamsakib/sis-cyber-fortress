import { NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import tls from 'node:tls';
import { canManageSecurityOps, getAuthenticatedProfile } from '@/lib/auth/rbac';
import { recordAuditLog } from '@/lib/audit';
import {
  WEBSHIELD_SECURITY_HEADERS,
  scoreWebShieldEvaluation,
} from '@/lib/security/analyzers';

function inspectTlsCertificate(hostname: string): Promise<{
  valid: boolean;
  issuer: string | null;
  expiresAt: string | null;
}> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        timeout: 5000,
      },
      () => {
        const cert = socket.getPeerCertificate();
        const authorized = socket.authorized;
        socket.end();
        if (!cert || Object.keys(cert).length === 0) {
          resolve({ valid: false, issuer: null, expiresAt: null });
          return;
        }
        const issuer =
          typeof cert.issuer?.O === 'string'
            ? cert.issuer.O
            : typeof cert.issuer?.CN === 'string'
            ? cert.issuer.CN
            : null;
        const expiresAt = cert.valid_to ? new Date(cert.valid_to).toISOString() : null;
        resolve({ valid: authorized, issuer, expiresAt });
      }
    );

    socket.on('error', () => {
      resolve({ valid: false, issuer: null, expiresAt: null });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ valid: false, issuer: null, expiresAt: null });
    });
  });
}

export async function GET(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile(request);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('webshield_scans')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scans: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile(request);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canManageSecurityOps(profile.role)) {
    return NextResponse.json({ error: 'Insufficient role clearance.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { assetId?: string } | null;
  if (!body?.assetId) {
    return NextResponse.json({ error: 'Authorized assetId is required.' }, { status: 400 });
  }

  const { data: asset, error: assetErr } = await supabase
    .from('authorized_assets')
    .select('*')
    .eq('id', body.assetId)
    .eq('asset_type', 'website')
    .eq('is_authorized', true)
    .maybeSingle();

  if (assetErr || !asset) {
    return NextResponse.json(
      { error: 'Target must be registered and authorized as a website asset before scanning.' },
      { status: 403 }
    );
  }

  let parsed: URL;
  try {
    const raw = asset.identifier.trim();
    parsed = new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`);
  } catch {
    return NextResponse.json({ error: 'Invalid website identifier on asset.' }, { status: 400 });
  }

  const hostname = parsed.hostname;
  const [tlsInfo, aRecords, mxRecords, txtRecords] = await Promise.all([
    inspectTlsCertificate(hostname),
    dns.resolve4(hostname).catch(() => [] as string[]),
    dns.resolveMx(hostname).then((r) => r.map((m) => m.exchange)).catch(() => [] as string[]),
    dns.resolveTxt(hostname).then((r) => r.slice(0, 3).map((t) => t.join(''))).catch(() => [] as string[]),
  ]);

  let httpStatus: number | null = null;
  const headersReport: Record<string, { present: boolean; value: string | null }> = {};

  try {
    const res = await fetch(parsed.href, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
    });
    httpStatus = res.status;
    for (const h of WEBSHIELD_SECURITY_HEADERS) {
      const val = res.headers.get(h);
      headersReport[h] = { present: Boolean(val), value: val };
    }
  } catch {
    for (const h of WEBSHIELD_SECURITY_HEADERS) {
      headersReport[h] = { present: false, value: null };
    }
  }

  const { securityScore: score, remediations } = scoreWebShieldEvaluation({
    tlsValid: tlsInfo.valid,
    hasARecords: aRecords.length > 0,
    headersReport,
  });

  const { data: scanRow, error: insertErr } = await supabase
    .from('webshield_scans')
    .insert({
      asset_id: asset.id,
      scanned_by: profile.id,
      target_url: parsed.href,
      http_status: httpStatus,
      tls_valid: tlsInfo.valid,
      tls_expires_at: tlsInfo.expiresAt,
      tls_issuer: tlsInfo.issuer,
      security_score: score,
      headers_report: headersReport,
      dns_records: { a: aRecords, mx: mxRecords, txt: txtRecords },
      remediations,
    })
    .select('*')
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await supabase
    .from('authorized_assets')
    .update({
      last_scanned_at: new Date().toISOString(),
      compliance_status: score >= 75 ? 'compliant' : score >= 50 ? 'warning' : 'non_compliant',
    })
    .eq('id', asset.id);

  await recordAuditLog(supabase, profile, {
    module_slug: '07-webshield',
    action: 'AUTHORIZED_WEBSHIELD_SCAN',
    resource_type: 'webshield_scans',
    resource_id: scanRow.id,
    details: { target_url: parsed.href, security_score: scanRow.security_score, tls_valid: tlsInfo.valid },
  });

  return NextResponse.json({ scan: scanRow }, { status: 201 });
}
