import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { canManageSecurityOps, getAuthenticatedProfile } from '@/lib/auth/rbac';
import { recordAuditLog } from '@/lib/audit';

const VALID_CASE_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const VALID_ARTIFACT_TYPES = [
  'log_bundle',
  'memory_hash',
  'network_pcap',
  'disk_image_meta',
  'email_header',
] as const;

export async function GET(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile(request);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [casesRes, evidenceRes] = await Promise.all([
    supabase.from('forensics_cases').select('*').order('created_at', { ascending: false }),
    supabase.from('forensics_evidence').select('*').order('created_at', { ascending: false }),
  ]);

  if (casesRes.error) {
    return NextResponse.json({ error: casesRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    cases: casesRes.data ?? [],
    evidence: evidenceRes.data ?? [],
  });
}

export async function POST(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile(request);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canManageSecurityOps(profile.role)) {
    return NextResponse.json({ error: 'Insufficient role clearance.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    type?: 'case' | 'evidence';
    title?: string;
    severity?: string;
    summary?: string;
    case_id?: string;
    evidence_label?: string;
    artifact_type?: string;
    custody_note?: string;
    raw_content_for_hash?: string;
  } | null;

  if (body?.type === 'evidence') {
    if (!body.case_id || !body.evidence_label?.trim() || !body.custody_note?.trim()) {
      return NextResponse.json(
        { error: 'case_id, evidence_label, and custody_note are required.' },
        { status: 400 }
      );
    }

    const artifactType = VALID_ARTIFACT_TYPES.includes(
      body.artifact_type as (typeof VALID_ARTIFACT_TYPES)[number]
    )
      ? body.artifact_type
      : 'log_bundle';

    // Real SHA-256 integrity digest computed from submitted evidence metadata/payload
    const checksum = createHash('sha256')
      .update(
        body.raw_content_for_hash?.trim() ||
          `${body.case_id}:${body.evidence_label.trim()}:${new Date().toISOString()}`
      )
      .digest('hex');

    const { data, error } = await supabase
      .from('forensics_evidence')
      .insert({
        case_id: body.case_id,
        collected_by: profile.id,
        evidence_label: body.evidence_label.trim(),
        artifact_type: artifactType,
        sha256_checksum: checksum,
        custody_note: body.custody_note.trim(),
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await recordAuditLog(supabase, profile, {
      module_slug: '08-digital-forensics',
      action: 'FORENSIC_EVIDENCE_LOGGED',
      resource_type: 'forensics_evidence',
      resource_id: data.id,
      details: { case_id: body.case_id, sha256: checksum },
    });

    return NextResponse.json({ evidence: data }, { status: 201 });
  }

  if (!body?.title?.trim() || !body?.summary?.trim()) {
    return NextResponse.json({ error: 'Case title and summary are required.' }, { status: 400 });
  }

  const severity = VALID_CASE_SEVERITIES.includes(
    body.severity as (typeof VALID_CASE_SEVERITIES)[number]
  )
    ? body.severity
    : 'high';

  const caseCode = `SIS-FOR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

  const { data, error } = await supabase
    .from('forensics_cases')
    .insert({
      case_code: caseCode,
      title: body.title.trim(),
      severity,
      status: 'open',
      lead_investigator: profile.id,
      summary: body.summary.trim(),
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, profile, {
    module_slug: '08-digital-forensics',
    action: 'FORENSIC_CASE_CREATED',
    resource_type: 'forensics_cases',
    resource_id: data.id,
    details: { case_code: caseCode, severity },
  });

  return NextResponse.json({ case: data }, { status: 201 });
}
