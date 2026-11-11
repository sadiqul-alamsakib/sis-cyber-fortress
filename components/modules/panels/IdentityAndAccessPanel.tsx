'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { ModuleSlug, UserProfile } from '@/types/security';

interface LoginActivity {
  id: string;
  created_at: string;
  email: string;
  provider: string;
  ip_address: string;
  user_agent: string | null;
  mfa_verified: boolean;
  risk_level: string;
}

interface MfaFactor {
  id: string;
  friendly_name?: string;
  status: string;
  factor_type: string;
}

export default function IdentityAndAccessPanel({
  slug,
  profile,
}: {
  slug: ModuleSlug;
  profile: UserProfile;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [activities, setActivities] = useState<LoginActivity[]>([]);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [mfaMsg, setMfaMsg] = useState<string | null>(null);

  // k-Anonymity Breach Checker state
  const [candidatePassword, setCandidatePassword] = useState('');
  const [breachResult, setBreachResult] = useState<{
    compromised: boolean;
    breachCount: number;
  } | null>(null);
  const [checkingBreach, setCheckingBreach] = useState(false);

  const loadData = useCallback(async () => {
    const [actRes, mfaRes] = await Promise.all([
      fetch('/api/modules/identity-breach'),
      supabase.auth.mfa.listFactors(),
    ]);
    if (actRes.ok) {
      const json = (await actRes.json()) as { activities?: LoginActivity[] };
      setActivities(json.activities ?? []);
    }
    if (mfaRes.data?.all) {
      setFactors(mfaRes.data.all as MfaFactor[]);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/modules/identity-breach').then((r) =>
        r.ok ? (r.json() as Promise<{ activities?: LoginActivity[] }>) : null
      ),
      supabase.auth.mfa.listFactors(),
    ]).then(([actJson, mfaRes]) => {
      if (!active) return;
      if (actJson) setActivities(actJson.activities ?? []);
      if (mfaRes.data?.all) setFactors(mfaRes.data.all as MfaFactor[]);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleRecordCurrentSession = async () => {
    const res = await fetch('/api/modules/identity-breach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'record_session' }),
    });
    if (res.ok) {
      await loadData();
    }
  };

  const handleEnrollMfa = async () => {
    setMfaMsg(null);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `SIS-Authenticator-${Date.now().toString().slice(-4)}`,
    });
    if (error) {
      setMfaMsg(`MFA enrollment note: ${error.message}`);
      return;
    }
    if (data?.totp?.qr_code) {
      setQrSvg(data.totp.qr_code);
      setPendingFactorId(data.id);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFactorId || !totpCode.trim()) return;
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: pendingFactorId,
    });
    if (chErr || !challenge) {
      setMfaMsg(chErr?.message ?? 'MFA challenge failed.');
      return;
    }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: pendingFactorId,
      challengeId: challenge.id,
      code: totpCode.trim(),
    });
    if (verErr) {
      setMfaMsg(`Verification failed: ${verErr.message}`);
      return;
    }
    setQrSvg(null);
    setPendingFactorId(null);
    setTotpCode('');
    setMfaMsg('TOTP MFA factor verified and activated.');
    await loadData();
  };

  const handleBreachCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidatePassword) return;
    setCheckingBreach(true);
    setBreachResult(null);

    try {
      const encoded = new TextEncoder().encode(candidatePassword);
      const digest = await crypto.subtle.digest('SHA-1', encoded);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

      const res = await fetch('/api/modules/identity-breach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'breach_check',
          sha1Prefix: hex.slice(0, 5),
          sha1Suffix: hex.slice(5),
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { compromised: boolean; breachCount: number };
        setBreachResult(json);
      }
    } finally {
      setCandidatePassword('');
      setCheckingBreach(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MFA & Passkey Readiness Card */}
        <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                {slug === '09-access-guardian'
                  ? 'Access Control & TOTP MFA Management'
                  : 'Identity MFA & Session Protection'}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Active Operator: <span className="text-amber-300">{profile.email}</span> ({profile.role})
              </p>
            </div>
            <button
              type="button"
              onClick={handleEnrollMfa}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer"
            >
              + Enroll TOTP MFA
            </button>
          </div>

          {mfaMsg && (
            <p className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-amber-300">
              {mfaMsg}
            </p>
          )}

          {qrSvg && (
            <form onSubmit={handleVerifyMfa} className="p-4 rounded-xl bg-[#07080b] border border-amber-500/30 space-y-3">
              <p className="text-xs text-zinc-300">
                Scan this QR code in Google Authenticator / Authy, then enter the 6-digit code:
              </p>
              <div
                className="w-40 h-40 bg-white p-2 rounded-lg"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="6-digit TOTP code"
                  className="px-3 py-1.5 rounded-lg text-xs bg-zinc-900 border border-zinc-700 text-zinc-100"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 cursor-pointer"
                >
                  Verify MFA
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Enrolled MFA Factors ({factors.length})
            </p>
            {factors.length === 0 ? (
              <p className="text-xs text-zinc-500">
                No TOTP factor enrolled yet. Click &ldquo;+ Enroll TOTP MFA&rdquo; above to add hardware/app 2FA.
              </p>
            ) : (
              factors.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#07080b] border border-zinc-800 text-xs"
                >
                  <span className="font-mono text-zinc-200">{f.friendly_name || f.factor_type}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-teal-500/15 text-teal-300 border border-teal-500/30">
                    {f.status}
                  </span>
                </div>
              ))
            )}
          </div>

          {slug === '09-access-guardian' && (
            <div className="pt-2 border-t border-zinc-800">
              <Link
                href="/dashboard/users"
                className="text-xs font-mono text-amber-300 hover:text-amber-200"
              >
                Open Central RBAC User Role Manager →
              </Link>
            </div>
          )}
        </div>

        {/* k-Anonymity Breach Checker Card */}
        <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Privacy-Preserving Compromised Credential Check
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Uses browser-side SHA-1 + k-Anonymity (only first 5 hash chars sent; zero plaintext stored).
            </p>
          </div>

          <form onSubmit={handleBreachCheck} className="space-y-3">
            <input
              type="password"
              value={candidatePassword}
              onChange={(e) => setCandidatePassword(e.target.value)}
              placeholder="Enter password to verify against breach corpus..."
              className="w-full px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100 placeholder-zinc-500"
            />
            <button
              type="submit"
              disabled={checkingBreach || !candidatePassword}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 cursor-pointer"
            >
              {checkingBreach ? 'Querying Range API...' : 'Run k-Anonymity Breach Check'}
            </button>
          </form>

          {breachResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs ${
                breachResult.compromised
                  ? 'bg-rose-500/10 border-rose-500/35 text-rose-300'
                  : 'bg-teal-500/10 border-teal-500/35 text-teal-300'
              }`}
            >
              {breachResult.compromised
                ? `COMPROMISED: Observed ${breachResult.breachCount.toLocaleString()} times in public breach datasets. Rotate immediately.`
                : 'CLEAR: 0 matches found in HaveIBeenPwned k-anonymity range.'}
            </div>
          )}
        </div>
      </div>

      {/* Login Activity History */}
      <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">
            Session &amp; Login Activity Log
          </h3>
          <button
            type="button"
            onClick={handleRecordCurrentSession}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-zinc-900 text-zinc-200 border border-zinc-700 hover:border-amber-500/40 cursor-pointer"
          >
            Log Current Verified Session
          </button>
        </div>
        {activities.length === 0 ? (
          <p className="p-6 text-xs text-zinc-500">
            No login activity records logged yet. Click &ldquo;Log Current Verified Session&rdquo; to record this session.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#090b0f] border-b border-zinc-800 text-[11px] font-mono text-zinc-400 uppercase">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Email</th>
                  <th className="py-2.5 px-4">Provider</th>
                  <th className="py-2.5 px-4">Risk</th>
                  <th className="py-2.5 px-4">User Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {activities.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-400">
                      {new Date(a.created_at).toISOString().replace('T', ' ').slice(0, 19)} UTC
                    </td>
                    <td className="py-2.5 px-4 text-zinc-200">{a.email}</td>
                    <td className="py-2.5 px-4 font-mono text-amber-300">{a.provider}</td>
                    <td className="py-2.5 px-4 font-mono text-teal-400">{a.risk_level}</td>
                    <td className="py-2.5 px-4 text-zinc-400 truncate max-w-xs">{a.user_agent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
