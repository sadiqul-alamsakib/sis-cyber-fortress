import { NextResponse } from 'next/server';
import { getAuthenticatedProfile } from '@/lib/auth/rbac';
import { recordAuditLog } from '@/lib/audit';
import {
  evaluateNetworkPosture,
  type NetworkEncryptionType,
} from '@/lib/security/analyzers';

const VALID_ENCRYPTION: readonly NetworkEncryptionType[] = [
  'WPA3',
  'WPA2',
  'WEP',
  'OPEN',
  'LAN_TLS',
];

export async function GET(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile(request);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('network_assessments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assessments: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile(request);
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    network_name?: string;
    encryption_type?: string;
    dns_sec_enabled?: boolean;
    vpn_active?: boolean;
    notes?: string;
  } | null;

  if (
    !body?.network_name?.trim() ||
    !VALID_ENCRYPTION.includes(body.encryption_type as NetworkEncryptionType)
  ) {
    return NextResponse.json(
      { error: 'Valid network_name and encryption_type are required.' },
      { status: 400 }
    );
  }

  const enc = body.encryption_type as NetworkEncryptionType;
  const { score, riskLevel } = evaluateNetworkPosture({
    encryptionType: enc,
    dnsSecEnabled: Boolean(body.dns_sec_enabled),
    vpnActive: Boolean(body.vpn_active),
  });

  const { data, error } = await supabase
    .from('network_assessments')
    .insert({
      assessed_by: profile.id,
      network_name: body.network_name.trim(),
      encryption_type: enc,
      dns_sec_enabled: Boolean(body.dns_sec_enabled),
      vpn_active: Boolean(body.vpn_active),
      risk_level: riskLevel,
      checklist_score: score,
      notes: body.notes?.trim() || null,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (enc === 'OPEN' || enc === 'WEP') {
    await supabase.from('security_logs').insert({
      source_ip: 'network-sentinel',
      event_type: 'UNSAFE_WIFI_DETECTED',
      message: `Network "${body.network_name.trim()}" reported with weak/open encryption (${enc})`,
      target_node: body.network_name.trim(),
      status: enc === 'OPEN' ? 'Critical' : 'Warning',
      is_resolved: false,
    });
  }

  await recordAuditLog(supabase, profile, {
    module_slug: '04-network-sentinel',
    action: 'NETWORK_POSTURE_ASSESSED',
    resource_type: 'network_assessments',
    resource_id: data.id,
    details: { network_name: data.network_name, encryption_type: enc, risk_level: riskLevel },
  });

  return NextResponse.json({ assessment: data }, { status: 201 });
}
