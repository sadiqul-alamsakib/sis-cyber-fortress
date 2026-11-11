import { NextResponse } from 'next/server';
import { canManageSecurityOps, getAuthenticatedProfile } from '@/lib/auth/rbac';
import { recordAuditLog } from '@/lib/audit';

const VALID_TYPES = ['website', 'android_device', 'server_node', 'network_ap'] as const;
const VALID_ENVS = ['production', 'staging', 'lab'] as const;
const VALID_COMPLIANCE = ['compliant', 'warning', 'non_compliant'] as const;

export async function GET() {
  const { supabase, profile } = await getAuthenticatedProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('authorized_assets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assets: data ?? [] });
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
    name?: string;
    asset_type?: string;
    identifier?: string;
    environment?: string;
    os_or_stack?: string;
    compliance_status?: string;
  } | null;

  if (
    !body?.name?.trim() ||
    !body?.identifier?.trim() ||
    !VALID_TYPES.includes(body.asset_type as (typeof VALID_TYPES)[number])
  ) {
    return NextResponse.json(
      { error: 'Valid name, identifier, and asset_type are required.' },
      { status: 400 }
    );
  }

  const environment = VALID_ENVS.includes(body.environment as (typeof VALID_ENVS)[number])
    ? body.environment
    : 'lab';
  const compliance_status = VALID_COMPLIANCE.includes(
    body.compliance_status as (typeof VALID_COMPLIANCE)[number]
  )
    ? body.compliance_status
    : 'compliant';

  const { data, error } = await supabase
    .from('authorized_assets')
    .insert({
      name: body.name.trim(),
      asset_type: body.asset_type,
      identifier: body.identifier.trim(),
      environment,
      compliance_status,
      is_authorized: true,
      os_or_stack: body.os_or_stack?.trim() || null,
      registered_by: profile.id,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, profile, {
    module_slug: body.asset_type === 'website' ? '07-webshield' : '03-endpoint-guardian',
    action: 'ASSET_REGISTERED',
    resource_type: 'authorized_assets',
    resource_id: data.id,
    details: { name: data.name, asset_type: data.asset_type, identifier: data.identifier },
  });

  return NextResponse.json({ asset: data }, { status: 201 });
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
    return NextResponse.json({ error: 'Asset id is required.' }, { status: 400 });
  }

  const { error } = await supabase.from('authorized_assets').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, profile, {
    module_slug: '03-endpoint-guardian',
    action: 'ASSET_REMOVED',
    resource_type: 'authorized_assets',
    resource_id: id,
  });

  return NextResponse.json({ deleted: true });
}
