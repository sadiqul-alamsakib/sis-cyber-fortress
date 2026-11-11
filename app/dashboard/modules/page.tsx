import { Suspense } from 'react';
import Link from 'next/link';
import { requireDashboardSession } from '@/lib/auth/session-guard';
import { SECURITY_MODULES } from '@/lib/modules/catalog';
import DashboardShell from '@/components/dashboard/DashboardShell';

async function ModulesDirectoryContent() {
  const { profile } = await requireDashboardSession();

  return (
    <DashboardShell
      profile={profile}
      title="12-in-1 Security Modules Directory"
      subtitle="Unified integration hub for all SIS Cyber Fortress defense, forensics, and governance modules"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SECURITY_MODULES.map((mod) => (
          <Link
            key={mod.slug}
            href={`/dashboard/modules/${mod.slug}`}
            className="group rounded-xl bg-[#0d0f14] border border-zinc-800 hover:border-amber-500/45 p-5 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/12 text-amber-300 border border-amber-500/25">
                  MODULE {mod.code}
                </span>
                <span className="text-[11px] font-mono text-zinc-500">{mod.category}</span>
              </div>
              <h2 className="mt-3 text-base font-semibold text-zinc-100 group-hover:text-amber-300 transition-colors">
                {mod.name}
              </h2>
              <p className="mt-1.5 text-xs text-zinc-400">{mod.summary}</p>
              <ul className="mt-3 space-y-1 text-[11px] text-zinc-400">
                {mod.capabilities.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800/70 flex items-center justify-between text-xs font-mono">
              <span className="text-teal-400">● API Connected</span>
              <span className="text-amber-300 group-hover:translate-x-0.5 transition-transform">
                Open Console →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </DashboardShell>
  );
}

export default function ModulesDirectoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07080b]" />}>
      <ModulesDirectoryContent />
    </Suspense>
  );
}
