'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { canManageSecurityOps } from '@/lib/auth/roles';
import type {
  AuthorizedAsset,
  DeviceCommand,
  DeviceCommandType,
  SecurityPolicy,
  UserProfile,
} from '@/types/security';

export default function UnifiedControlClient({
  profile,
  initialAssets,
  initialCommands,
  initialPolicies,
}: {
  profile: UserProfile;
  initialAssets: AuthorizedAsset[];
  initialCommands: DeviceCommand[];
  initialPolicies: SecurityPolicy[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const canControl = canManageSecurityOps(profile.role);

  const [assets, setAssets] = useState<AuthorizedAsset[]>(initialAssets);
  const [commands, setCommands] = useState<DeviceCommand[]>(initialCommands);
  const [policies, setPolicies] = useState<SecurityPolicy[]>(initialPolicies);
  const [alertMessage, setAlertMessage] = useState(
    'Security Notice: Verify VPN and WPA3 connection before accessing SOC.'
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  const handleCopyMobileToken = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setStatusBanner('No active session token found. Please re-login on web first.');
      return;
    }
    await navigator.clipboard.writeText(token);
    setTokenCopied(true);
    setStatusBanner('Operator Session Token copied! Paste it into "Connect via Operator Session Token" on your Android app.');
    setTimeout(() => setTokenCopied(false), 3000);
  };

  const androidAndNodes = useMemo(
    () => assets.filter((a) => a.asset_type !== 'website'),
    [assets]
  );
  const websites = useMemo(
    () => assets.filter((a) => a.asset_type === 'website'),
    [assets]
  );

  useEffect(() => {
    const channel = supabase
      .channel('unified-control-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_commands' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const created = payload.new as DeviceCommand;
            setCommands((prev) =>
              prev.some((c) => c.id === created.id) ? prev : [created, ...prev].slice(0, 50)
            );
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as DeviceCommand;
            setCommands((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'security_policies' },
        (payload) => {
          const updated = payload.new as SecurityPolicy;
          setPolicies((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'authorized_assets' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const added = payload.new as AuthorizedAsset;
            setAssets((prev) =>
              prev.some((a) => a.id === added.id) ? prev : [added, ...prev]
            );
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as AuthorizedAsset;
            setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleTogglePolicy = async (policy: SecurityPolicy) => {
    if (!canControl) return;
    setBusyId(policy.id);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: policy.id, enabled: !policy.enabled }),
      });
      const j = (await res.json()) as { policy?: SecurityPolicy; error?: string };
      if (!res.ok || !j.policy) {
        setStatusBanner(j.error ?? 'Failed to update policy.');
      } else {
        setPolicies((prev) => prev.map((p) => (p.id === policy.id ? j.policy! : p)));
        setStatusBanner(
          `Policy "${j.policy.policy_name}" is now ${j.policy.enabled ? 'ENFORCED' : 'DISABLED'} across ${j.policy.scope}.`
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDispatchCommand = async (
    asset: AuthorizedAsset,
    commandType: DeviceCommandType
  ) => {
    if (!canControl) return;
    setBusyId(`${asset.id}-${commandType}`);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/devices/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          commandType,
          payload:
            commandType === 'PUSH_SECURITY_ALERT'
              ? { message: alertMessage.trim() }
              : { issuedFrom: 'web_control_plane' },
        }),
      });
      const j = (await res.json()) as { command?: DeviceCommand; error?: string };
      if (!res.ok || !j.command) {
        setStatusBanner(j.error ?? 'Command dispatch failed.');
      } else {
        setCommands((prev) =>
          prev.some((c) => c.id === j.command!.id) ? prev : [j.command!, ...prev]
        );
        setStatusBanner(
          `Dispatched ${commandType} to ${asset.name}. Waiting for Android execution...`
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleRunWebsiteScan = async (site: AuthorizedAsset) => {
    if (!canControl) return;
    setBusyId(`scan-${site.id}`);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/modules/webshield-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: site.id }),
      });
      const j = (await res.json()) as {
        scan?: { security_score: number; tls_valid: boolean };
        error?: string;
      };
      if (!res.ok || !j.scan) {
        setStatusBanner(j.error ?? 'WebShield scan failed.');
      } else {
        setStatusBanner(
          `Live WebShield scan on ${site.name} completed: Score ${j.scan.security_score}/100 (TLS ${j.scan.tls_valid ? 'Valid' : 'Invalid'}).`
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const assetNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assets) map.set(a.id, a.name);
    return map;
  }, [assets]);

  return (
    <div className="space-y-6">
      {statusBanner && (
        <div className="p-3.5 rounded-xl bg-amber-500/12 border border-amber-500/35 text-xs text-amber-200 flex items-center justify-between">
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-amber-300 font-semibold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Mobile Pairing Helper (Useful when emulator lacks Google password) */}
      <section className="rounded-xl bg-[#0d0f14] border border-amber-500/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-amber-300">
            Quick Android Emulator / MuMu Pairing
          </p>
          <p className="text-[11px] text-zinc-400">
            If your emulator doesn&apos;t have your Google password signed in, copy your active session token and paste it in &ldquo;Connect via Operator Session Token&rdquo; on the Android app.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleCopyMobileToken()}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/35 hover:bg-amber-500/25 shrink-0 cursor-pointer"
        >
          {tokenCopied ? 'Token Copied ✓' : 'Copy Mobile Session Token'}
        </button>
      </section>

      {/* Global Shared Security Policies (Web + Android) */}
      <section className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Unified Security Policies (Synced Real-Time to Web &amp; Android App)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Toggling any policy immediately updates enforcement behavior across both the Next.js Web Platform and Kotlin Android App.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {policies.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-xl bg-[#07080b] border border-zinc-800 flex items-start justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-zinc-100">{p.policy_name}</p>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-900 text-amber-300 border border-zinc-700">
                    {p.scope}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">{p.description}</p>
              </div>
              <button
                type="button"
                disabled={!canControl || busyId === p.id}
                onClick={() => void handleTogglePolicy(p)}
                className={`px-3 py-1 rounded-full text-[11px] font-mono font-semibold border shrink-0 transition-colors cursor-pointer disabled:opacity-50 ${
                  p.enabled
                    ? 'bg-teal-500/15 text-teal-300 border-teal-500/35'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                }`}
              >
                {p.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Android Device Remote Control */}
      <section className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Android App &amp; Endpoint Remote Control
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Dispatch real-time ethical commands to enrolled Android devices (no silent spying or destructive remote wipe).
            </p>
          </div>
          <input
            type="text"
            value={alertMessage}
            onChange={(e) => setAlertMessage(e.target.value)}
            placeholder="Custom alert message for PUSH_SECURITY_ALERT..."
            className="w-full md:w-96 px-3 py-1.5 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-200"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {androidAndNodes.map((device) => (
            <div
              key={device.id}
              className="p-4 rounded-xl bg-[#07080b] border border-zinc-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{device.name}</p>
                  <p className="text-[11px] font-mono text-zinc-400">
                    {device.asset_type} • {device.identifier} • {device.os_or_stack || 'Android'}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase border ${
                    device.compliance_status === 'compliant'
                      ? 'bg-teal-500/12 text-teal-300 border-teal-500/30'
                      : 'bg-amber-500/12 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {device.compliance_status}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { type: 'SYNC_TELEMETRY', label: 'Sync Telemetry' },
                    { type: 'RUN_NETWORK_CHECK', label: 'Run Wi-Fi Check' },
                    { type: 'PUSH_SECURITY_ALERT', label: 'Push Alert' },
                    { type: 'LOCK_VAULT', label: 'Lock Mobile Vault' },
                    { type: 'REVOKE_SESSION', label: 'Revoke Session' },
                  ] as const
                ).map((btn) => (
                  <button
                    key={btn.type}
                    type="button"
                    disabled={!canControl || busyId === `${device.id}-${btn.type}`}
                    onClick={() => void handleDispatchCommand(device, btn.type)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
                      btn.type === 'REVOKE_SESSION' || btn.type === 'LOCK_VAULT'
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                        : 'bg-amber-500/12 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Website Remote Control */}
      <section className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-100">
          Authorized Website Control &amp; Live WebShield Trigger
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {websites.map((site) => (
            <div
              key={site.id}
              className="p-4 rounded-xl bg-[#07080b] border border-zinc-800 flex flex-col justify-between gap-3"
            >
              <div>
                <p className="text-sm font-semibold text-zinc-100">{site.name}</p>
                <p className="text-xs font-mono text-amber-300 break-all mt-0.5">
                  {site.identifier}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Status: {site.compliance_status} • Env: {site.environment}
                </p>
              </div>
              <button
                type="button"
                disabled={!canControl || busyId === `scan-${site.id}`}
                onClick={() => void handleRunWebsiteScan(site)}
                className="w-full py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer disabled:opacity-50"
              >
                {busyId === `scan-${site.id}` ? 'Scanning TLS/Headers...' : 'Run Live WebShield Scan'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Live Remote Command Execution Queue */}
      <section className="rounded-xl bg-[#0d0f14] border border-zinc-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">
            Live Command Queue (Dashboard ↔ Android / Web)
          </h2>
          <span className="text-[11px] font-mono text-teal-400">REALTIME SYNC</span>
        </div>
        {commands.length === 0 ? (
          <p className="p-6 text-xs text-zinc-500">
            No remote commands dispatched yet. Click any command button above to test real-time orchestration.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#090b0f] border-b border-zinc-800 text-[11px] font-mono uppercase text-zinc-400">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Target Asset</th>
                  <th className="py-2.5 px-4">Command</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Execution Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {commands.map((cmd) => (
                  <tr key={cmd.id}>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                      {new Date(cmd.created_at).toISOString().replace('T', ' ').slice(0, 19)} UTC
                    </td>
                    <td className="py-2.5 px-4 text-zinc-200">
                      {assetNameById.get(cmd.asset_id) ?? cmd.asset_id.slice(0, 8)}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-amber-300">{cmd.command_type}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase border ${
                          cmd.status === 'executed'
                            ? 'bg-teal-500/12 text-teal-300 border-teal-500/35'
                            : cmd.status === 'failed'
                            ? 'bg-rose-500/12 text-rose-400 border-rose-500/35'
                            : 'bg-amber-500/12 text-amber-300 border-amber-500/35'
                        }`}
                      >
                        {cmd.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-400">
                      {cmd.result_message || 'Awaiting device acknowledgement...'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
