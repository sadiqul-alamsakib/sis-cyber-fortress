import type { ModuleSlug } from '@/types/security';

export interface SecurityModuleSpec {
  code: string;
  slug: ModuleSlug;
  name: string;
  shortTitle: string;
  category: 'Identity & Access' | 'Threat Defense' | 'Endpoint & Network' | 'Data & Recovery' | 'Governance & SOC';
  summary: string;
  capabilities: string[];
  ethicalRule: string;
}

export const SECURITY_MODULES: SecurityModuleSpec[] = [
  {
    code: '01',
    slug: '01-identity-guardian',
    name: 'SIS Identity Guardian',
    shortTitle: 'Identity Guardian',
    category: 'Identity & Access',
    summary: 'Digital identity protection, MFA readiness, login activity monitoring & k-anonymity breach checks.',
    capabilities: [
      'Secure OAuth & TOTP MFA enrollment status',
      'Live login activity & suspicious sign-in detection',
      'Privacy-preserving SHA-1 prefix breach check (never stores plaintext)',
    ],
    ethicalRule: 'Zero plaintext password collection or storage.',
  },
  {
    code: '02',
    slug: '02-phishing-shield',
    name: 'SIS Phishing Shield',
    shortTitle: 'Phishing Shield',
    category: 'Threat Defense',
    summary: 'Real-time URL/domain inspection, DNS lookup, IOC correlation & threat reporting.',
    capabilities: [
      'Real URL structure, IDN homograph & IP-literal checks',
      'Live DNS record resolution & Threat IOC matching',
      'Threat report submission directly to SOC pipeline',
    ],
    ethicalRule: 'Deterministic inspection and real DNS checks; no fabricated scan scores.',
  },
  {
    code: '03',
    slug: '03-endpoint-guardian',
    name: 'SIS Endpoint Guardian',
    shortTitle: 'Endpoint Guardian',
    category: 'Endpoint & Network',
    summary: 'Registered Android/Server endpoint inventory, OS posture & compliance tracking.',
    capabilities: [
      'Device registration & authorized asset inventory',
      'OS/Stack & compliance posture monitoring',
      'Android policy & permission audit metadata',
    ],
    ethicalRule: 'Respects Android OS & Device Owner boundaries; no forced bypass.',
  },
  {
    code: '04',
    slug: '04-network-sentinel',
    name: 'SIS Network Sentinel',
    shortTitle: 'Network Sentinel',
    category: 'Endpoint & Network',
    summary: 'Wi-Fi & network security awareness, unsafe encryption alerts & checklist scoring.',
    capabilities: [
      'WPA3/WPA2/OPEN encryption risk evaluation',
      'DNSSEC & VPN posture checklist verification',
      'Centralized device network risk summary',
    ],
    ethicalRule: 'Operates strictly within authorized network telemetry & user consent.',
  },
  {
    code: '05',
    slug: '05-vault-guardian',
    name: 'SIS Vault Guardian',
    shortTitle: 'Vault Guardian',
    category: 'Data & Recovery',
    summary: 'Zero-knowledge client-side AES-256-GCM encrypted notes & credential vault.',
    capabilities: [
      'Browser-side PBKDF2 + AES-256-GCM encryption via Web Crypto API',
      'Server & PostgreSQL store ciphertext, IV & salt only',
      'Owner-only RLS policy blocks even Super Admin access',
    ],
    ethicalRule: 'Super Admin and Backend APIs can never view vault plaintext.',
  },
  {
    code: '06',
    slug: '06-ransomware-guardian',
    name: 'SIS Ransomware Guardian',
    shortTitle: 'Ransomware Guardian',
    category: 'Data & Recovery',
    summary: 'Ransomware readiness verification, recovery SLA tracking & response checklists.',
    capabilities: [
      'Real-time backup health & recovery readiness posture',
      'Encrypted snapshot verification without running live malware',
      'Incident containment & response checklist',
    ],
    ethicalRule: 'Safe verification only; real ransomware execution is strictly prohibited.',
  },
  {
    code: '07',
    slug: '07-webshield',
    name: 'SIS WebShield',
    shortTitle: 'WebShield',
    category: 'Threat Defense',
    summary: 'Authorized website SSL/TLS certificate inspection, DNS & HTTP security header audit.',
    capabilities: [
      'Restricted strictly to domains in Authorized Asset Registry',
      'Live TLS certificate validity, issuer & expiry inspection',
      'Live HSTS, CSP, X-Frame-Options & remediation reporting',
    ],
    ethicalRule: 'Scans authorized assets only; blocks unauthorized external targets.',
  },
  {
    code: '08',
    slug: '08-digital-forensics',
    name: 'SIS Digital Forensics',
    shortTitle: 'Digital Forensics',
    category: 'Governance & SOC',
    summary: 'Incident case management, SHA-256 evidence artifacts & chain-of-custody logs.',
    capabilities: [
      'Structured case creation & severity tracking',
      'Immutable evidence metadata & SHA-256 checksums',
      'Chronological chain-of-custody log & JSON export',
    ],
    ethicalRule: 'Read-only evidence custody & explicit investigator attribution.',
  },
  {
    code: '09',
    slug: '09-access-guardian',
    name: 'SIS Access Guardian',
    shortTitle: 'Access Guardian',
    category: 'Identity & Access',
    summary: 'Centralized RBAC role governance, TOTP MFA enrollment & session control.',
    capabilities: [
      '4-tier Enterprise Admin roles + Viewer RBAC',
      'Active session & MFA factor management',
      'Privilege escalation protection via PostgreSQL RLS',
    ],
    ethicalRule: 'Least-privilege defaults with full audit trail on role changes.',
  },
  {
    code: '10',
    slug: '10-threat-intelligence',
    name: 'SIS Threat Intelligence',
    shortTitle: 'Threat Intelligence',
    category: 'Threat Defense',
    summary: 'Indicator of Compromise (IOC) repository for domains, URLs, IPs & file hashes.',
    capabilities: [
      'IOC management (domain, URL, IP, SHA-256 hash)',
      'Cross-module correlation with Phishing Shield & SOC logs',
      'Severity tagging, feed attribution & search',
    ],
    ethicalRule: 'Verified threat indicators only; source attribution required.',
  },
  {
    code: '11',
    slug: '11-cloud-backup-guardian',
    name: 'SIS Cloud Backup Guardian',
    shortTitle: 'Cloud Backup Guardian',
    category: 'Data & Recovery',
    summary: 'Encrypted backup scheduling, retention policies, storage telemetry & integrity checks.',
    capabilities: [
      'Cron schedule & retention window governance',
      'AES-256-GCM encryption standard enforcement',
      'Integrity verification & restore workflow triggers',
    ],
    ethicalRule: 'Verifiable checksum integrity & non-destructive recovery testing.',
  },
  {
    code: '12',
    slug: '12-cyber-soc',
    name: 'SIS Cyber SOC',
    shortTitle: 'Cyber SOC',
    category: 'Governance & SOC',
    summary: 'Unified Security Operations Center for alert triage, incident workflow & analytics.',
    capabilities: [
      'Real-time security_logs stream & SOC incident queue',
      'Severity prioritization & open -> resolved workflow',
      'Module-wide telemetry & audit correlation',
    ],
    ethicalRule: '100% live database metrics; zero synthetic statistics.',
  },
];

export function getModuleBySlug(slug: string): SecurityModuleSpec | undefined {
  return SECURITY_MODULES.find((m) => m.slug === slug);
}
