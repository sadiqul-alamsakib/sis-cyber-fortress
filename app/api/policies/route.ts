import { NextResponse } from 'next/server';
import { canManageSecurityOps, getAuthenticatedProfile } from '@/lib/auth/rbac';
import { recordAuditLog } from '@/lib/audit';

export async function GET(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile(request);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('security_policies')
    .select('*')
    .order('policy_key', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ policies: data ?? [] });
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
    enabled?: boolean;
  } | null;

  if (!body?.id || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Valid policy id and enabled boolean required.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('security_policies')
    .update({
      enabled: body.enabled,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    })
    .eq('id', body.id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, profile, {
    module_slug: '09-access-guardian',
    action: 'GLOBAL_POLICY_TOGGLED',
    resource_type: 'security_policies',
    resource_id: data.id,
    details: { policy_key: data.policy_key, enabled: data.enabled, scope: data.scope },
  });

  return NextResponse.json({ policy: data });
}
