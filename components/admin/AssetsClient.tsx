'use client';

import React, { useState } from 'react';
import { canManageSecurityOps } from '@/lib/auth/roles';
import type { AuthorizedAsset, UserProfile } from '@/types/security';

export default function AssetsClient({
  profile,
  initialAssets,
}: {
  profile: UserProfile;
  initialAssets: AuthorizedAsset[];
}) {
  const [assets, setAssets] = useState<AuthorizedAsset[]>(initialAssets);
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<'website' | 'android_device' | 'server_node' | 'network_ap'>('website');
  const [identifier, setIdentifier] = useState('');
  const [environment, setEnvironment] = useState<'production' | 'staging' | 'lab'>('lab');
  const [osOrStack, setOsOrStack] = useState('');
  const [busy, setBusy] = useState(false);

  const canEdit = canManageSecurityOps(profile.role);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !identifier.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          asset_type: assetType,
          identifier: identifier.trim(),
          environment,
          os_or_stack: osOrStack.trim() || null,
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { asset: AuthorizedAsset };
        setAssets((prev) => [j.asset, ...prev]);
        setName('');
        setIdentifier('');
        setOsOrStack('');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/assets?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setAssets((prev) => prev.filter((a) => a.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <form
          onSubmit={handleAdd}
          className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-zinc-100">
            Register Authorized Asset (Website / Device / Node)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Asset Name"
              className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            />
            <select
              value={assetType}
              onChange={(e) =>
                setAssetType(
                  e.target.value as 'website' | 'android_device' | 'server_node' | 'network_ap'
                )
              }
              className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            >
              <option value="website">Authorized Website</option>
              <option value="android_device">Android Device</option>
              <option value="server_node">Server Node</option>
              <option value="network_ap">Network AP</option>
            </select>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="https://domain.com or IP/ID"
              className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            />
            <select
              value={environment}
              onChange={(e) =>
                setEnvironment(e.target.value as 'production' | 'staging' | 'lab')
              }
              className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            >
              <option value="lab">Lab</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
            <input
              type="text"
              value={osOrStack}
              onChange={(e) => setOsOrStack(e.target.value)}
              placeholder="OS / Tech Stack"
              className="px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !name.trim() || !identifier.trim()}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 cursor-pointer"
          >
            {busy ? 'Registering...' : '+ Add Authorized Asset'}
          </button>
        </form>
      )}

      <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#090b0f] border-b border-zinc-800 text-[11px] font-mono uppercase text-zinc-400">
              <tr>
                <th className="py-3 px-5">Name</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Identifier</th>
                <th className="py-3 px-4">Environment</th>
                <th className="py-3 px-4">Compliance</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-zinc-800/30">
                  <td className="py-3.5 px-5 font-medium text-zinc-100">{asset.name}</td>
                  <td className="py-3.5 px-4 font-mono text-amber-300">{asset.asset_type}</td>
                  <td className="py-3.5 px-4 font-mono text-zinc-300">{asset.identifier}</td>
                  <td className="py-3.5 px-4 font-mono text-zinc-400">{asset.environment}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-mono border ${
                        asset.compliance_status === 'compliant'
                          ? 'bg-teal-500/12 text-teal-300 border-teal-500/30'
                          : asset.compliance_status === 'warning'
                          ? 'bg-amber-500/12 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/12 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {asset.compliance_status}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => void handleDelete(asset.id)}
                        className="text-[11px] text-rose-400 hover:text-rose-300 cursor-pointer"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-[11px] text-zinc-500">Read-only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
