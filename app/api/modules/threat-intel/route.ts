import { NextResponse } from 'next/server';
import { canManageSecurityOps, getAuthenticatedProfile } from '@/lib/auth/rbac';
import { recordAuditLog } from '@/lib/audit';

const VALID_TYPES = ['domain', 'url', 'ip', 'hash'] as const;
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export async function GET() {
  const { supabase, profile } = await getAuthenticatedProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('threat_iocs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ iocs: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canManageSecurityOps(profile.role)) {
    return NextResponse.json({ error: 'Insufficient role clearance.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    ioc_type?: string;
    indicator?: string;
    severity?: string;
    source_feed?: string;
    tags?: string[];
  } | null;

  if (
    !body?.indicator?.trim() ||
    !VALID_TYPES.includes(body.ioc_type as (typeof VALID_TYPES)[number])
  ) {
    return NextResponse.json(
      { error: 'Valid ioc_type and indicator are required.' },
      { status: 400 }
    );
  }

  const severity = VALID_SEVERITIES.includes(
    body.severity as (typeof VALID_SEVERITIES)[number]
  )
    ? body.severity
    : 'high';

  const { data, error } = await supabase
    .from('threat_iocs')
    .insert({
      added_by: profile.id,
      ioc_type: body.ioc_type,
      indicator: body.indicator.trim().toLowerCase(),
      severity,
      source_feed: body.source_feed?.trim() || 'SIS-Internal-SOC',
      tags: Array.isArray(body.tags) ? body.tags.slice(0, 8) : [],
      is_active: true,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, profile, {
    module_slug: '10-threat-intelligence',
    action: 'THREAT_IOC_ADDED',
    resource_type: 'threat_iocs',
    resource_id: data.id,
    details: { ioc_type: data.ioc_type, indicator: data.indicator, severity: data.severity },
  });

  return NextResponse.json({ ioc: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canManageSecurityOps(profile.role)) {
    return NextResponse.json({ error: 'Insufficient role clearance.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'IOC id is required.' }, { status: 400 });
  }

  const { error } = await supabase.from('threat_iocs').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
