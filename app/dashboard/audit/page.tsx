import { Suspense } from 'react';
import { requireDashboardSession } from '@/lib/auth/session-guard';
import DashboardShell from '@/components/dashboard/DashboardShell';
import type { AuditLogEntry } from '@/types/security';

async function AuditContent() {
  const { supabase, profile } = await requireDashboardSession();

  const { data } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  const logs = (data ?? []) as AuditLogEntry[];

  return (
    <DashboardShell
      profile={profile}
      title="System Audit Trail"
      subtitle="Immutable record of who performed which security action, on which module, and when"
    >
      <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">
            Audit Log Entries ({logs.length})
          </h2>
          <span className="text-[11px] font-mono text-amber-300">
            public.audit_logs
          </span>
        </div>
        {logs.length === 0 ? (
          <p className="p-6 text-xs text-zinc-500">No audit events logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#090b0f] border-b border-zinc-800 text-[11px] font-mono uppercase text-zinc-400">
                <tr>
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-800/30">
                    <td className="py-3 px-5 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                      {new Date(entry.created_at).toISOString().replace('T', ' ').slice(0, 19)} UTC
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-200">{entry.actor_email}</td>
                    <td className="py-3 px-4 font-mono text-amber-300">{entry.actor_role}</td>
                    <td className="py-3 px-4 font-mono text-zinc-300">{entry.module_slug}</td>
                    <td className="py-3 px-4 font-mono text-teal-300">{entry.action}</td>
                    <td className="py-3 px-5 font-mono text-[11px] text-zinc-400 max-w-sm truncate">
                      {JSON.stringify(entry.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07080b]" />}>
      <AuditContent />
    </Suspense>
  );
}
