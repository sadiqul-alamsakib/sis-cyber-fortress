import { NextResponse } from 'next/server';
import { getAuthenticatedProfile } from '@/lib/auth/rbac';
import { recordAuditLog } from '@/lib/audit';

export async function GET() {
  const { supabase, profile } = await getAuthenticatedProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('login_activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activities: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: 'breach_check' | 'record_session';
    sha1Prefix?: string;
    sha1Suffix?: string;
  } | null;

  if (body?.action === 'record_session') {
    const userAgent = request.headers.get('user-agent') ?? 'Unknown Browser';
    const { data, error } = await supabase
      .from('login_activities')
      .insert({
        user_id: profile.id,
        email: profile.email,
        provider: 'google',
        ip_address: request.headers.get('x-forwarded-for') ?? 'localhost',
        user_agent: userAgent.slice(0, 180),
        mfa_verified: true,
        risk_level: 'low',
        is_suspicious: false,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ activity: data }, { status: 201 });
  }

  // k-Anonymity check: client hashes candidate locally with SHA-1 and sends ONLY 5-char prefix + suffix for local matching
  const prefix = body?.sha1Prefix?.toUpperCase();
  const suffix = body?.sha1Suffix?.toUpperCase();
  if (!prefix || !/^[0-9A-F]{5}$/.test(prefix) || !suffix || !/^[0-9A-F]{35}$/.test(suffix)) {
    return NextResponse.json(
      { error: 'Valid 5-char SHA-1 prefix and 35-char suffix required (no plaintext allowed).' },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Breach intelligence service unavailable.' }, { status: 502 });
    }

    const text = await res.text();
    let breachCount = 0;
    for (const line of text.split('\n')) {
      const [hashSuffix, countStr] = line.trim().split(':');
      if (hashSuffix === suffix) {
        breachCount = Number.parseInt(countStr ?? '0', 10) || 0;
        break;
      }
    }

    await recordAuditLog(supabase, profile, {
      module_slug: '01-identity-guardian',
      action: 'K_ANONYMITY_BREACH_CHECK',
      resource_type: 'identity_check',
      details: { compromised: breachCount > 0 },
    });

    return NextResponse.json({ compromised: breachCount > 0, breachCount });
  } catch {
    return NextResponse.json({ error: 'Failed to reach HIBP range service.' }, { status: 502 });
  }
}
