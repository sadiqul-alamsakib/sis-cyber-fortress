const SUSPICIOUS_TLDS = new Set([
  'xyz', 'top', 'click', 'gq', 'tk', 'ml', 'cf', 'ga', 'zip', 'mov', 'work',
]);

const PHISHING_KEYWORDS = [
  'login', 'verify', 'update', 'secure', 'banking', 'wallet', 'account', 'signin', 'confirm',
];

export const WEBSHIELD_SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
] as const;

export interface PhishingHeuristicResult {
  parsedUrl: URL;
  hostname: string;
  baseRiskScore: number;
  findings: string[];
}

export function analyzePhishingUrl(rawUrl: string): PhishingHeuristicResult {
  const trimmed = rawUrl.trim();
  const normalized =
    trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

  const parsedUrl = new URL(normalized);
  const hostname = parsedUrl.hostname.toLowerCase();
  const findings: string[] = [];
  let baseRiskScore = 0;

  if (parsedUrl.protocol === 'http:') {
    baseRiskScore += 20;
    findings.push('Unencrypted HTTP transport (no TLS)');
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith('[')) {
    baseRiskScore += 35;
    findings.push('IP-literal host detected instead of registered domain');
  }

  if (hostname.includes('xn--')) {
    baseRiskScore += 30;
    findings.push('Punycode / IDN homograph domain encoding detected');
  }

  const tld = hostname.split('.').pop() ?? '';
  if (SUSPICIOUS_TLDS.has(tld)) {
    baseRiskScore += 20;
    findings.push(`High-abuse TLD (.${tld}) observed`);
  }

  const matchedKeywords = PHISHING_KEYWORDS.filter(
    (kw) => hostname.includes(kw) || parsedUrl.pathname.toLowerCase().includes(kw)
  );
  if (matchedKeywords.length >= 2) {
    baseRiskScore += 25;
    findings.push(`Multiple credential-lure keywords in URL: ${matchedKeywords.join(', ')}`);
  }

  if (hostname.split('.').length >= 4) {
    baseRiskScore += 15;
    findings.push('Excessive subdomain nesting depth (>= 4 labels)');
  }

  return { parsedUrl, hostname, baseRiskScore, findings };
}

export function classifyPhishingRisk(score: number): 'safe' | 'suspicious' | 'malicious' {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped >= 60) return 'malicious';
  if (clamped >= 25) return 'suspicious';
  return 'safe';
}

export function scoreWebShieldEvaluation(params: {
  tlsValid: boolean;
  hasARecords: boolean;
  headersReport: Record<string, { present: boolean; value: string | null }>;
}): { securityScore: number; remediations: string[] } {
  const remediations: string[] = [];
  let score = 0;

  if (params.tlsValid) {
    score += 35;
  } else {
    remediations.push('Enable valid CA-signed HTTPS / TLS 1.3 certificate on port 443.');
  }

  if (params.hasARecords) {
    score += 15;
  } else {
    remediations.push('Verify DNS A record propagation for target domain.');
  }

  for (const header of WEBSHIELD_SECURITY_HEADERS) {
    if (params.headersReport[header]?.present) {
      score += 10;
    } else {
      remediations.push(`Configure HTTP security header: ${header}`);
    }
  }

  if (remediations.length === 0) {
    remediations.push('All inspected TLS, DNS, and HTTP security headers are properly configured.');
  }

  return { securityScore: Math.min(100, score), remediations };
}

export type NetworkEncryptionType = 'WPA3' | 'WPA2' | 'WEP' | 'OPEN' | 'LAN_TLS';

export function evaluateNetworkPosture(params: {
  encryptionType: NetworkEncryptionType;
  dnsSecEnabled: boolean;
  vpnActive: boolean;
}): { score: number; riskLevel: 'low' | 'medium' | 'high' | 'critical' } {
  const { encryptionType, dnsSecEnabled, vpnActive } = params;
  let score =
    encryptionType === 'WPA3' || encryptionType === 'LAN_TLS'
      ? 60
      : encryptionType === 'WPA2'
      ? 45
      : encryptionType === 'WEP'
      ? 15
      : 0;

  if (dnsSecEnabled) score += 20;
  if (vpnActive) score += 20;

  const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
    score >= 80 ? 'low' : score >= 55 ? 'medium' : score >= 30 ? 'high' : 'critical';

  return { score, riskLevel };
}
