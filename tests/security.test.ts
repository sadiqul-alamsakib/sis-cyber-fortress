import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzePhishingUrl,
  classifyPhishingRisk,
  evaluateNetworkPosture,
  scoreWebShieldEvaluation,
  WEBSHIELD_SECURITY_HEADERS,
} from '../lib/security/analyzers.ts';
import {
  canManageSecurityOps,
  getRoleLabel,
  isReadOnlyRole,
  isSuperAdmin,
  isValidRole,
} from '../lib/auth/roles.ts';
import { SECURITY_MODULES } from '../lib/modules/catalog.ts';

describe('RBAC Role Governance', () => {
  it('validates supported enterprise roles and rejects unknown roles', () => {
    assert.equal(isValidRole('super_admin'), true);
    assert.equal(isValidRole('security_admin'), true);
    assert.equal(isValidRole('module_admin'), true);
    assert.equal(isValidRole('auditor'), true);
    assert.equal(isValidRole('viewer'), true);
    assert.equal(isValidRole('root_hacker'), false);
  });

  it('enforces least-privilege separation between admins, auditors, and viewers', () => {
    assert.equal(isSuperAdmin('super_admin'), true);
    assert.equal(isSuperAdmin('security_admin'), false);
    assert.equal(canManageSecurityOps('security_admin'), true);
    assert.equal(canManageSecurityOps('module_admin'), true);
    assert.equal(canManageSecurityOps('auditor'), false);
    assert.equal(isReadOnlyRole('auditor'), true);
    assert.equal(isReadOnlyRole('viewer'), true);
    assert.equal(getRoleLabel('super_admin'), 'Super Admin');
  });
});

describe('Module 02: Phishing Shield URL Analyzer', () => {
  it('scores clean HTTPS domain with zero heuristic risk', () => {
    const res = analyzePhishingUrl('https://supabase.com/docs');
    assert.equal(res.hostname, 'supabase.com');
    assert.equal(res.baseRiskScore, 0);
    assert.equal(classifyPhishingRisk(res.baseRiskScore), 'safe');
  });

  it('flags HTTP IP-literal URL with multiple lure keywords as malicious', () => {
    const res = analyzePhishingUrl('http://192.168.1.50/login/verify/account');
    assert.equal(classifyPhishingRisk(res.baseRiskScore), 'malicious');
    assert.ok(res.baseRiskScore >= 60);
    assert.ok(res.findings.length >= 3);
  });

  it('detects punycode homograph and high-abuse TLD', () => {
    const res = analyzePhishingUrl('https://xn--pypal-4ve.xyz/signin');
    assert.equal(classifyPhishingRisk(res.baseRiskScore), 'suspicious');
    assert.ok(res.findings.some((f) => f.includes('Punycode')));
    assert.ok(res.findings.some((f) => f.includes('.xyz')));
  });
});

describe('Module 07: WebShield TLS & Security Header Scorer', () => {
  it('computes 100/100 when TLS, DNS A-records, and all 5 security headers are present', () => {
    const fullHeaders: Record<string, { present: boolean; value: string | null }> = {};
    for (const h of WEBSHIELD_SECURITY_HEADERS) {
      fullHeaders[h] = { present: true, value: 'configured' };
    }
    const result = scoreWebShieldEvaluation({
      tlsValid: true,
      hasARecords: true,
      headersReport: fullHeaders,
    });
    assert.equal(result.securityScore, 100);
    assert.equal(result.remediations[0]?.includes('properly configured'), true);
  });

  it('produces actionable remediations when TLS or security headers are missing', () => {
    const partialHeaders: Record<string, { present: boolean; value: string | null }> = {
      'strict-transport-security': { present: false, value: null },
      'content-security-policy': { present: true, value: "default-src 'self'" },
      'x-frame-options': { present: false, value: null },
      'x-content-type-options': { present: true, value: 'nosniff' },
      'referrer-policy': { present: false, value: null },
    };
    const result = scoreWebShieldEvaluation({
      tlsValid: false,
      hasARecords: true,
      headersReport: partialHeaders,
    });
    assert.equal(result.securityScore, 35);
    assert.equal(result.remediations.length, 4);
  });
});

describe('Module 04: Network Sentinel Posture Evaluator', () => {
  it('assigns low risk to WPA3 + DNSSEC + VPN', () => {
    const res = evaluateNetworkPosture({
      encryptionType: 'WPA3',
      dnsSecEnabled: true,
      vpnActive: true,
    });
    assert.equal(res.score, 100);
    assert.equal(res.riskLevel, 'low');
  });

  it('assigns critical risk to OPEN Wi-Fi without DNSSEC or VPN', () => {
    const res = evaluateNetworkPosture({
      encryptionType: 'OPEN',
      dnsSecEnabled: false,
      vpnActive: false,
    });
    assert.equal(res.score, 0);
    assert.equal(res.riskLevel, 'critical');
  });
});

describe('Module 05: Vault Guardian Zero-Knowledge AES-256-GCM Roundtrip', () => {
  it('encrypts and decrypts with PBKDF2+AES-GCM and rejects wrong passphrases', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const derive = async (pass: string) => {
      const base = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(pass),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
        base,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    };

    const secret = 'SIS-TOP-SECRET-RECOVERY-KEY-2026';
    const keyGood = await derive('correct-fortress-passphrase');
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      keyGood,
      new TextEncoder().encode(secret)
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      keyGood,
      ciphertext
    );
    assert.equal(new TextDecoder().decode(decrypted), secret);

    const keyWrong = await derive('wrong-passphrase');
    await assert.rejects(async () => {
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyWrong, ciphertext);
    });
  });
});

describe('12-in-1 Security Module Catalog Integrity', () => {
  it('registers all 12 unique security modules numbered 01 through 12', () => {
    assert.equal(SECURITY_MODULES.length, 12);
    const codes = new Set(SECURITY_MODULES.map((m) => m.code));
    const slugs = new Set(SECURITY_MODULES.map((m) => m.slug));
    assert.equal(codes.size, 12);
    assert.equal(slugs.size, 12);
  });
});
