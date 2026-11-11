import { NextResponse } from 'next/server';
import { getAuthenticatedProfile, isSuperAdmin, isValidRole } from '@/lib/auth/rbac';
import { recordAuditLog } from '@/lib/audit';

export async function GET() {
  const { supabase, profile } = await getAuthenticatedProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (
    profile.role !== 'super_admin' &&
    profile.role !== 'security_admin' &&
    profile.role !== 'auditor' &&
    profile.role !== 'admin'
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}

export async function PATCH(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isSuperAdmin(profile.role)) {
    return NextResponse.json(
      { error: 'Only Super Admin can assign or modify user roles.' },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    role?: string;
  } | null;

  if (!body?.userId || !isValidRole(body.role)) {
    return NextResponse.json(
      { error: 'Invalid userId or role specified.' },
      { status: 400 }
    );
  }

  if (body.userId === profile.id && body.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Super Admin cannot demote their own active session role.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ role: body.role })
    .eq('id', body.userId)
    .select('id, email, full_name, avatar_url, role, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, profile, {
    module_slug: '09-access-guardian',
    action: 'USER_ROLE_UPDATED',
    resource_type: 'profiles',
    resource_id: body.userId,
    details: { target_email: data.email, new_role: body.role },
  });

  return NextResponse.json({ user: data });
}
