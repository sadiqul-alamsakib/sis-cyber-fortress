import { NextResponse } from 'next/server';
import { canManageSecurityOps, getAuthenticatedProfile } from '@/lib/auth/rbac';
import { recordAuditLog } from '@/lib/audit';

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const VALID_STATUSES = ['open', 'investigating', 'contained', 'resolved'] as const;

export async function GET(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile(request);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [incidentsRes, logsRes] = await Promise.all([
    supabase.from('soc_incidents').select('*').order('created_at', { ascending: false }),
    supabase.from('security_logs').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  if (incidentsRes.error) {
    return NextResponse.json({ error: incidentsRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    incidents: incidentsRes.data ?? [],
    securityLogs: logsRes.data ?? [],
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
    title?: string;
    module_source?: string;
    severity?: string;
    description?: string;
  } | null;

  if (!body?.title?.trim() || !body?.description?.trim()) {
    return NextResponse.json({ error: 'Title and description are required.' }, { status: 400 });
  }

  const severity = VALID_SEVERITIES.includes(
    body.severity as (typeof VALID_SEVERITIES)[number]
  )
    ? body.severity
    : 'high';

  const { data, error } = await supabase
    .from('soc_incidents')
    .insert({
      title: body.title.trim(),
      module_source: body.module_source?.trim() || '12-cyber-soc',
      severity,
      status: 'open',
      assigned_to: profile.id,
      created_by: profile.id,
      description: body.description.trim(),
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, profile, {
    module_slug: '12-cyber-soc',
    action: 'INCIDENT_CREATED',
    resource_type: 'soc_incidents',
    resource_id: data.id,
    details: { title: data.title, severity: data.severity },
  });

  return NextResponse.json({ incident: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile(request);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canManageSecurityOps(profile.role)) {
    return NextResponse.json({ error: 'Insufficient role clearance.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: string;
  } | null;

  if (!body?.id || !VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ error: 'Valid id and status are required.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('soc_incidents')
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, profile, {
    module_slug: '12-cyber-soc',
    action: 'INCIDENT_STATUS_UPDATED',
    resource_type: 'soc_incidents',
    resource_id: body.id,
    details: { status: body.status },
  });

  return NextResponse.json({ incident: data });
}
