import { NextResponse } from 'next/server';
import { getAuthenticatedProfile } from '@/lib/auth/rbac';

export async function GET(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile(request);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data ?? [] });
}
