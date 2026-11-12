import { NextResponse } from 'next/server';
import { getAuthenticatedProfile } from '@/lib/auth/rbac';
import { recordAuditLog } from '@/lib/audit';

export async function POST(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile(request);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    deviceIdentifier?: string;
    deviceName?: string;
    osVersion?: string;
    securityPatch?: string;
    installedAppsCount?: number;
    dangerousPermissionApps?: number;
    isVpnActive?: boolean;
    networkType?: string;
  } | null;

  if (!body?.deviceIdentifier?.trim() || !body?.deviceName?.trim()) {
    return NextResponse.json(
      { error: 'deviceIdentifier and deviceName are required.' },
      { status: 400 }
    );
  }

  const identifier = body.deviceIdentifier.trim();
  const now = new Date().toISOString();
  const complianceStatus =
    (body.dangerousPermissionApps ?? 0) > 10 || body.networkType === 'OPEN'
      ? 'warning'
      : 'compliant';

  const metadata = {
    securityPatch: body.securityPatch ?? 'unknown',
    installedAppsCount: body.installedAppsCount ?? 0,
    dangerousPermissionApps: body.dangerousPermissionApps ?? 0,
    isVpnActive: Boolean(body.isVpnActive),
    networkType: body.networkType ?? 'unknown',
    lastHeartbeatAt: now,
  };

  // Find or register this Android device in authorized_assets
  const { data: existing } = await supabase
    .from('authorized_assets')
    .select('id')
    .eq('identifier', identifier)
    .eq('asset_type', 'android_device')
    .maybeSingle();

  let assetId: string;
  if (existing) {
    assetId = existing.id;
    await supabase
      .from('authorized_assets')
      .update({
        name: body.deviceName.trim(),
        os_or_stack: body.osVersion?.trim() || 'Android',
        compliance_status: complianceStatus,
        last_scanned_at: now,
        updated_at: now,
        metadata,
      })
      .eq('id', assetId);
  } else {
    const { data: created, error: createErr } = await supabase
      .from('authorized_assets')
      .insert({
        name: body.deviceName.trim(),
        asset_type: 'android_device',
        identifier,
        environment: 'lab',
        is_authorized: true,
        compliance_status: complianceStatus,
        os_or_stack: body.osVersion?.trim() || 'Android',
        last_scanned_at: now,
        registered_by: profile.id,
        metadata,
      })
      .select('id')
      .single();

    if (createErr || !created) {
      return NextResponse.json(
        { error: createErr?.message ?? 'Failed to register device.' },
        { status: 500 }
      );
    }
    assetId = created.id;

    await recordAuditLog(supabase, profile, {
      module_slug: '03-endpoint-guardian',
      action: 'ANDROID_DEVICE_ENROLLED',
      resource_type: 'authorized_assets',
      resource_id: assetId,
      details: { deviceName: body.deviceName.trim(), osVersion: body.osVersion },
    });
  }

  // Return pending commands + active global/android policies for this device
  const [commandsRes, policiesRes] = await Promise.all([
    supabase
      .from('device_commands')
      .select('*')
      .eq('asset_id', assetId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase
      .from('security_policies')
      .select('policy_key, policy_name, scope, enabled')
      .in('scope', ['global', 'android']),
  ]);

  return NextResponse.json({
    assetId,
    complianceStatus,
    pendingCommands: commandsRes.data ?? [],
    policies: policiesRes.data ?? [],
  });
}
