import { NextResponse } from 'next/server';
import { canManageSecurityOps, getAuthenticatedProfile } from '@/lib/auth/rbac';
import { recordAuditLog } from '@/lib/audit';
import type { DeviceCommandType } from '@/types/security';

const VALID_COMMANDS: readonly DeviceCommandType[] = [
  'SYNC_TELEMETRY',
  'LOCK_VAULT',
  'REVOKE_SESSION',
  'PUSH_SECURITY_ALERT',
  'RUN_NETWORK_CHECK',
  'RUN_BACKUP_DRILL',
  'RUN_WEBSHIELD_SCAN',
];

const VALID_STATUSES = ['pending', 'acknowledged', 'executed', 'failed'] as const;

export async function GET(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile(request);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get('assetId');
  const status = searchParams.get('status');

  let query = supabase
    .from('device_commands')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (assetId) {
    query = query.eq('asset_id', assetId);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ commands: data ?? [] });
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
    assetId?: string;
    commandType?: string;
    payload?: Record<string, unknown>;
  } | null;

  if (
    !body?.assetId ||
    !VALID_COMMANDS.includes(body.commandType as DeviceCommandType)
  ) {
    return NextResponse.json(
      { error: 'Valid assetId and commandType are required.' },
      { status: 400 }
    );
  }

  const { data: asset } = await supabase
    .from('authorized_assets')
    .select('id, name, asset_type, identifier')
    .eq('id', body.assetId)
    .maybeSingle();

  if (!asset) {
    return NextResponse.json({ error: 'Target asset not found.' }, { status: 404 });
  }

  const targetPlatform: 'android' | 'web' =
    asset.asset_type === 'website' ? 'web' : 'android';

  const { data: cmdRow, error } = await supabase
    .from('device_commands')
    .insert({
      asset_id: asset.id,
      target_platform: targetPlatform,
      command_type: body.commandType,
      payload: body.payload ?? {},
      status: 'pending',
      issued_by: profile.id,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also log high-visibility control event in security_logs & audit_logs
  await supabase.from('security_logs').insert({
    source_ip: 'super-admin-console',
    event_type: `REMOTE_CMD_${body.commandType}`,
    message: `Dispatched ${body.commandType} to ${asset.name} (${targetPlatform})`,
    target_node: asset.identifier,
    status: body.commandType === 'REVOKE_SESSION' || body.commandType === 'LOCK_VAULT' ? 'Warning' : 'Secure',
    is_resolved: true,
    resolved_by: profile.id,
  });

  await recordAuditLog(supabase, profile, {
    module_slug: targetPlatform === 'android' ? '03-endpoint-guardian' : '07-webshield',
    action: 'REMOTE_COMMAND_DISPATCHED',
    resource_type: 'device_commands',
    resource_id: cmdRow.id,
    details: { asset: asset.name, command_type: body.commandType, target_platform: targetPlatform },
  });

  return NextResponse.json({ command: cmdRow }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile(request);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: string;
    resultMessage?: string;
  } | null;

  if (
    !body?.id ||
    !VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])
  ) {
    return NextResponse.json({ error: 'Valid id and status are required.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('device_commands')
    .update({
      status: body.status,
      updated_at: now,
      executed_at: body.status === 'executed' ? now : null,
      result_message: body.resultMessage?.trim() || null,
    })
    .eq('id', body.id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, profile, {
    module_slug: '03-endpoint-guardian',
    action: 'REMOTE_COMMAND_UPDATED',
    resource_type: 'device_commands',
    resource_id: data.id,
    details: { status: data.status, result_message: data.result_message },
  });

  return NextResponse.json({ command: data });
}
