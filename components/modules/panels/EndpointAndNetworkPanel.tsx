'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { AuthorizedAsset, ModuleSlug, NetworkAssessment } from '@/types/security';

export default function EndpointAndNetworkPanel({ slug }: { slug: ModuleSlug }) {
  const isNetwork = slug === '04-network-sentinel';

  const [assets, setAssets] = useState<AuthorizedAsset[]>([]);
  const [assessments, setAssessments] = useState<NetworkAssessment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Endpoint registration form
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState<'android_device' | 'server_node'>('android_device');
  const [identifier, setIdentifier] = useState('');
  const [osStack, setOsStack] = useState('');

  // Network assessment form
  const [networkName, setNetworkName] = useState('');
  const [encryptionType, setEncryptionType] = useState<'WPA3' | 'WPA2' | 'WEP' | 'OPEN' | 'LAN_TLS'>('WPA3');
  const [dnsSec, setDnsSec] = useState(true);
  const [vpnActive, setVpnActive] = useState(true);

  const loadData = useCallback(async () => {
    if (isNetwork) {
      const res = await fetch('/api/modules/network');
      if (res.ok) {
        const j = (await res.json()) as { assessments?: NetworkAssessment[] };
        setAssessments(j.assessments ?? []);
      }
    } else {
      const res = await fetch('/api/assets');
      if (res.ok) {
        const j = (await res.json()) as { assets?: AuthorizedAsset[] };
        setAssets(
          (j.assets ?? []).filter(
            (a) => a.asset_type === 'android_device' || a.asset_type === 'server_node'
          )
        );
      }
    }
  }, [isNetwork]);

  useEffect(() => {
    let active = true;
    if (isNetwork) {
      fetch('/api/modules/network')
        .then((res) => (res.ok ? (res.json() as Promise<{ assessments?: NetworkAssessment[] }>) : null))
        .then((j) => {
          if (active && j) setAssessments(j.assessments ?? []);
        });
    } else {
      fetch('/api/assets')
        .then((res) => (res.ok ? (res.json() as Promise<{ assets?: AuthorizedAsset[] }>) : null))
        .then((j) => {
          if (active && j) {
            setAssets(
              (j.assets ?? []).filter(
                (a) => a.asset_type === 'android_device' || a.asset_type === 'server_node'
              )
            );
          }
        });
    }
    return () => {
      active = false;
    };
  }, [isNetwork]);

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim() || !identifier.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: deviceName.trim(),
          asset_type: deviceType,
          identifier: identifier.trim(),
          environment: 'lab',
          os_or_stack: osStack.trim() || 'Android / Linux Endpoint',
        }),
      });
      if (res.ok) {
        setDeviceName('');
        setIdentifier('');
        setOsStack('');
        await loadData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleNetworkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!networkName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/modules/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network_name: networkName.trim(),
          encryption_type: encryptionType,
          dns_sec_enabled: dnsSec,
          vpn_active: vpnActive,
        }),
      });
      if (res.ok) {
        setNetworkName('');
        await loadData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (isNetwork) {
    return (
      <div className="space-y-6">
        <form
          onSubmit={handleNetworkSubmit}
          className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-zinc-100">
            Wi-Fi &amp; Network Security Checklist Assessment
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={networkName}
              onChange={(e) => setNetworkName(e.target.value)}
              placeholder="SSID / Network Name (e.g., SIS-CAMPUS-5G)"
              className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            />
            <select
              value={encryptionType}
              onChange={(e) =>
                setEncryptionType(
                  e.target.value as 'WPA3' | 'WPA2' | 'WEP' | 'OPEN' | 'LAN_TLS'
                )
              }
              className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            >
              <option value="WPA3">WPA3-Enterprise (Strong)</option>
              <option value="LAN_TLS">mTLS Wired LAN</option>
              <option value="WPA2">WPA2-PSK</option>
              <option value="WEP">WEP (Legacy Unsafe)</option>
              <option value="OPEN">OPEN Wi-Fi (Critical Risk)</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-6 text-xs text-zinc-300">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dnsSec}
                onChange={(e) => setDnsSec(e.target.checked)}
                className="accent-amber-400"
              />
              DNSSEC / Encrypted DNS Verified
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={vpnActive}
                onChange={(e) => setVpnActive(e.target.checked)}
                className="accent-amber-400"
              />
              Zero-Trust VPN Tunnel Active
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting || !networkName.trim()}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Scoring...' : 'Evaluate & Save Network Risk'}
          </button>
        </form>

        <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-100">Device Network Risk Summary</h3>
          </div>
          {assessments.length === 0 ? (
            <p className="p-6 text-xs text-zinc-500">No network assessments recorded yet.</p>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {assessments.map((a) => (
                <div key={a.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-zinc-100">{a.network_name}</p>
                    <p className="font-mono text-[11px] text-zinc-400">
                      {a.encryption_type} • DNSSEC: {a.dns_sec_enabled ? 'Yes' : 'No'} • VPN:{' '}
                      {a.vpn_active ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-zinc-200">{a.checklist_score}/100</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase border ${
                        a.risk_level === 'critical' || a.risk_level === 'high'
                          ? 'bg-rose-500/12 text-rose-400 border-rose-500/35'
                          : a.risk_level === 'medium'
                          ? 'bg-amber-500/12 text-amber-300 border-amber-500/35'
                          : 'bg-teal-500/12 text-teal-300 border-teal-500/35'
                      }`}
                    >
                      {a.risk_level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleRegisterDevice}
        className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-4"
      >
        <h3 className="text-sm font-semibold text-zinc-100">
          Register Authorized Android / Server Endpoint
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="Endpoint Name"
            className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
          />
          <select
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value as 'android_device' | 'server_node')}
            className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
          >
            <option value="android_device">Android Device</option>
            <option value="server_node">Server Node</option>
          </select>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Device ID / Hostname"
            className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
          />
          <input
            type="text"
            value={osStack}
            onChange={(e) => setOsStack(e.target.value)}
            placeholder="OS / Policy (e.g., Android 15)"
            className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !deviceName.trim() || !identifier.trim()}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 cursor-pointer"
        >
          {submitting ? 'Registering...' : 'Register Authorized Endpoint'}
        </button>
      </form>

      <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-100">
            Endpoint Inventory &amp; Compliance Posture ({assets.length})
          </h3>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {assets.map((asset) => (
            <div key={asset.id} className="p-4 flex items-center justify-between gap-4 text-xs">
              <div>
                <p className="font-semibold text-zinc-100">{asset.name}</p>
                <p className="font-mono text-[11px] text-zinc-400">
                  {asset.asset_type} • {asset.identifier} • {asset.os_or_stack || 'N/A'}
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase bg-teal-500/12 text-teal-300 border border-teal-500/35">
                {asset.compliance_status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
