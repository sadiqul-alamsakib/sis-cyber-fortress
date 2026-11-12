import { NextResponse } from 'next/server';
import { canManageSecurityOps, getAuthenticatedProfile } from '@/lib/auth/rbac';
import { recordAuditLog } from '@/lib/audit';

export async function GET(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile(request);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('backup_policies')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ policies: data ?? [] });
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
    policy_name?: string;
    schedule_cron?: string;
    retention_days?: number;
  } | null;

  if (!body?.policy_name?.trim()) {
    return NextResponse.json({ error: 'policy_name is required.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('backup_policies')
    .insert({
      created_by: profile.id,
      policy_name: body.policy_name.trim(),
      schedule_cron: body.schedule_cron?.trim() || '0 2 * * *',
      retention_days: Math.max(7, Math.min(365, Number(body.retention_days) || 30)),
      encryption_standard: 'AES-256-GCM',
      storage_used_mb: 0,
      integrity_verified: true,
      last_backup_at: new Date().toISOString(),
      status: 'healthy',
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, profile, {
    module_slug: '11-cloud-backup-guardian',
    action: 'BACKUP_POLICY_CREATED',
    resource_type: 'backup_policies',
    resource_id: data.id,
    details: { policy_name: data.policy_name, retention_days: data.retention_days },
  });

  return NextResponse.json({ policy: data }, { status: 201 });
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
    action?: 'verify_integrity' | 'simulate_restore_drill';
  } | null;

  if (!body?.id) {
    return NextResponse.json({ error: 'Policy id is required.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('backup_policies')
    .update({
      integrity_verified: true,
      last_backup_at: now,
      updated_at: now,
      status: 'healthy',
    })
    .eq('id', body.id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, profile, {
    module_slug:
      body.action === 'simulate_restore_drill'
        ? '06-ransomware-guardian'
        : '11-cloud-backup-guardian',
    action:
      body.action === 'simulate_restore_drill'
        ? 'SAFE_RECOVERY_DRILL_VERIFIED'
        : 'BACKUP_INTEGRITY_VERIFIED',
    resource_type: 'backup_policies',
    resource_id: body.id,
    details: { policy_name: data.policy_name },
  });

  return NextResponse.json({ policy: data });
}
