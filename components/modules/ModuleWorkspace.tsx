'use client';

import React from 'react';
import Link from 'next/link';
import type { SecurityModuleSpec } from '@/lib/modules/catalog';
import type { UserProfile } from '@/types/security';
import IdentityAndAccessPanel from './panels/IdentityAndAccessPanel';
import PhishingAndWebShieldPanel from './panels/PhishingAndWebShieldPanel';
import EndpointAndNetworkPanel from './panels/EndpointAndNetworkPanel';
import VaultAndBackupPanel from './panels/VaultAndBackupPanel';
import ForensicsThreatSocPanel from './panels/ForensicsThreatSocPanel';

export default function ModuleWorkspace({
  mod,
  profile,
}: {
  mod: SecurityModuleSpec;
  profile: UserProfile;
}) {
  const renderPanel = () => {
    switch (mod.slug) {
      case '01-identity-guardian':
      case '09-access-guardian':
        return <IdentityAndAccessPanel slug={mod.slug} profile={profile} />;
      case '02-phishing-shield':
      case '07-webshield':
        return <PhishingAndWebShieldPanel slug={mod.slug} />;
      case '03-endpoint-guardian':
      case '04-network-sentinel':
        return <EndpointAndNetworkPanel slug={mod.slug} />;
      case '05-vault-guardian':
      case '06-ransomware-guardian':
      case '11-cloud-backup-guardian':
        return <VaultAndBackupPanel slug={mod.slug} />;
      case '08-digital-forensics':
      case '10-threat-intelligence':
      case '12-cyber-soc':
        return <ForensicsThreatSocPanel slug={mod.slug} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/modules"
              className="text-xs font-mono text-zinc-400 hover:text-amber-300"
            >
              ← 12 Modules
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/12 text-amber-300 border border-amber-500/30">
              MODULE {mod.code}
            </span>
            <span className="text-[11px] font-mono text-zinc-400">{mod.category}</span>
          </div>
          <p className="text-xs text-zinc-300">{mod.summary}</p>
          <p className="text-[11px] font-mono text-teal-400">
            Security &amp; Ethical Boundary: {mod.ethicalRule}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 lg:max-w-sm">
          {mod.capabilities.map((cap, idx) => (
            <span
              key={idx}
              className="px-2 py-1 rounded-md text-[10px] bg-[#07080b] border border-zinc-800 text-zinc-400"
            >
              ✓ {cap}
            </span>
          ))}
        </div>
      </div>

      {renderPanel()}
    </div>
  );
}
