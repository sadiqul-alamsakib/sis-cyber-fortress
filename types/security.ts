export type ThreatStatus = 'Critical' | 'Warning' | 'Secure';

export type UserRole =
  | 'super_admin'
  | 'security_admin'
  | 'module_admin'
  | 'auditor'
  | 'admin'
  | 'analyst'
  | 'viewer';

export type ModuleSlug =
  | '01-identity-guardian'
  | '02-phishing-shield'
  | '03-endpoint-guardian'
  | '04-network-sentinel'
  | '05-vault-guardian'
  | '06-ransomware-guardian'
  | '07-webshield'
  | '08-digital-forensics'
  | '09-access-guardian'
  | '10-threat-intelligence'
  | '11-cloud-backup-guardian'
  | '12-cyber-soc';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at?: string;
}

export interface SecurityLog {
  id: string;
  created_at: string;
  source_ip: string;
  event_type: string;
  message: string;
  target_node: string;
  status: ThreatStatus;
  is_resolved: boolean;
  resolved_by?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuthorizedAsset {
  id: string;
  created_at: string;
  name: string;
  asset_type: 'website' | 'android_device' | 'server_node' | 'network_ap';
  identifier: string;
  environment: 'production' | 'staging' | 'lab';
  is_authorized: boolean;
  compliance_status: 'compliant' | 'warning' | 'non_compliant';
  os_or_stack: string | null;
  last_scanned_at: string | null;
  metadata?: Record<string, unknown>;
}

export interface PhishingScan {
  id: string;
  created_at: string;
  target_url: string;
  hostname: string;
  risk_score: number;
  verdict: 'safe' | 'suspicious' | 'malicious';
  findings: string[];
  dns_resolved: boolean;
  is_reported_threat: boolean;
}

export interface WebShieldScan {
  id: string;
  created_at: string;
  asset_id: string;
  target_url: string;
  http_status: number | null;
  tls_valid: boolean;
  tls_expires_at: string | null;
  tls_issuer: string | null;
  security_score: number;
  headers_report: Record<string, { present: boolean; value: string | null }>;
  dns_records: { a?: string[]; mx?: string[]; txt?: string[] };
  remediations: string[];
}

export interface ThreatIOC {
  id: string;
  created_at: string;
  ioc_type: 'domain' | 'url' | 'ip' | 'hash';
  indicator: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source_feed: string;
  tags: string[];
  is_active: boolean;
}

export interface VaultItemCipher {
  id: string;
  created_at: string;
  title: string;
  category: 'credential' | 'secure_note' | 'recovery_key' | 'document';
  ciphertext: string;
  iv: string;
  salt: string;
  kdf_algorithm: string;
}

export interface ForensicsCase {
  id: string;
  created_at: string;
  case_code: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'analyzing' | 'preserved' | 'closed';
  summary: string;
}

export interface ForensicsEvidence {
  id: string;
  created_at: string;
  case_id: string;
  evidence_label: string;
  artifact_type: 'log_bundle' | 'memory_hash' | 'network_pcap' | 'disk_image_meta' | 'email_header';
  sha256_checksum: string;
  custody_note: string;
}

export interface BackupPolicy {
  id: string;
  created_at: string;
  policy_name: string;
  schedule_cron: string;
  retention_days: number;
  encryption_standard: string;
  storage_used_mb: number;
  integrity_verified: boolean;
  last_backup_at: string | null;
  status: 'healthy' | 'warning' | 'failed' | 'restoring';
}

export interface NetworkAssessment {
  id: string;
  created_at: string;
  network_name: string;
  encryption_type: 'WPA3' | 'WPA2' | 'WEP' | 'OPEN' | 'LAN_TLS';
  dns_sec_enabled: boolean;
  vpn_active: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  checklist_score: number;
  notes: string | null;
}

export interface SocIncident {
  id: string;
  created_at: string;
  title: string;
  module_source: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'contained' | 'resolved';
  description: string;
}

export interface AuditLogEntry {
  id: string;
  created_at: string;
  actor_email: string;
  actor_role: string;
  module_slug: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
}
