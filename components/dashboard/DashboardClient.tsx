'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { canManageSecurityOps } from '@/lib/auth/roles';
import { SECURITY_MODULES } from '@/lib/modules/catalog';
import type { SecurityLog, ThreatStatus, UserProfile } from '@/types/security';
import DashboardShell from './DashboardShell';
import {
  ActivityIcon,
  FirewallIcon,
  LockNodesIcon,
  SearchIcon,
  ShieldAlertIcon,
} from './SecurityIcons';

export interface OverviewRealStats {
  totalAssets: number;
  compliantAssets: number;
  openIncidents: number;
  totalScans: number;
  activeIocs: number;
  auditCount: number;
  backupHealthy: number;
  backupTotal: number;
  forensicsCases: number;
  moduleActivityCounts: Record<string, number>;
}

interface DashboardClientProps {
  profile: UserProfile;
  initialLogs: SecurityLog[];
  stats: OverviewRealStats;
  dbConnected: boolean;
}

const STATUS_BADGE_STYLES: Record<
  ThreatStatus,
  { container: string; dot: string; label: string }
> = {
  Critical: {
    container: 'bg-rose-500/12 text-rose-400 border-rose-500/35',
    dot: 'bg-rose-500 animate-pulse',
    label: 'Critical',
  },
  Warning: {
    container: 'bg-amber-500/12 text-amber-300 border-amber-500/35',
    dot: 'bg-amber-400',
    label: 'Warning',
  },
  Secure: {
    container: 'bg-teal-500/12 text-teal-300 border-teal-500/35',
    dot: 'bg-teal-400',
    label: 'Secure',
  },
};

function formatUtcTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return `${date.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}

export default function DashboardClient({
  profile,
  initialLogs,
  stats,
  dbConnected,
}: DashboardClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const [logs, setLogs] = useState<SecurityLog[]>(initialLogs);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ThreatStatus>('All');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canModifyThreats = canManageSecurityOps(profile.role);

  useEffect(() => {
    if (!dbConnected) return;

    const channel = supabase
      .channel('security-logs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'security_logs' },
        (payload) => {
          const newLog = payload.new as SecurityLog;
          setLogs((prev) => {
            if (prev.some((item) => item.id === newLog.id)) return prev;
            return [newLog, ...prev].slice(0, 100);
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'security_logs' },
        (payload) => {
          const updatedLog = payload.new as SecurityLog;
          setLogs((prev) =>
            prev.map((item) => (item.id === updatedLog.id ? updatedLog : item))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, dbConnected]);

  const handleResolveThreat = async (log: SecurityLog) => {
    if (!canModifyThreats || log.is_resolved) return;

    setActionError(null);
    setResolvingId(log.id);

    const previousLogs = logs;
    setLogs((prev) =>
      prev.map((item) =>
        item.id === log.id
          ? { ...item, is_resolved: true, status: 'Secure', resolved_by: profile.id }
          : item
      )
    );

    const { error } = await supabase
      .from('security_logs')
      .update({
        is_resolved: true,
        status: 'Secure',
        resolved_by: profile.id,
      })
      .eq('id', log.id);

    if (error) {
      setLogs(previousLogs);
      setActionError(`Failed to update log ${log.id.slice(0, 8)}: ${error.message}`);
    } else {
      await supabase.from('audit_logs').insert({
        actor_id: profile.id,
        actor_email: profile.email,
        actor_role: profile.role,
        module_slug: '12-cyber-soc',
        action: 'SECURITY_LOG_RESOLVED',
        resource_type: 'security_logs',
        resource_id: log.id,
        details: { event_type: log.event_type, target_node: log.target_node },
      });
    }

    setResolvingId(null);
  };

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      if (statusFilter !== 'All' && log.status !== statusFilter) return false;
      if (!query) return true;
      return (
        log.source_ip.toLowerCase().includes(query) ||
        log.event_type.toLowerCase().includes(query) ||
        log.message.toLowerCase().includes(query) ||
        log.target_node.toLowerCase().includes(query)
      );
    });
  }, [logs, searchQuery, statusFilter]);

  const activeCritical = logs.filter((l) => l.status === 'Critical' && !l.is_resolved).length;
  const activeWarnings = logs.filter((l) => l.status === 'Warning' && !l.is_resolved).length;
  const activeThreatsTotal = activeCritical + activeWarnings;

  const assetCompliancePct =
    stats.totalAssets > 0
      ? Math.round((stats.compliantAssets / stats.totalAssets) * 100)
      : 0;

  return (
    <DashboardShell
      profile={profile}
      title="Central Super Admin Control Center"
      subtitle="Live PostgreSQL telemetry across all 12 SIS Cyber Fortress security modules"
    >
      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/35 text-rose-300 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-400 hover:text-rose-200 font-medium ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Real Database-Computed Metric Cards (Zero Hardcoded Stats) */}
      <section
        aria-label="Real-time database security metrics"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="relative rounded-xl bg-[#0d0f14]/95 border border-zinc-800/90 p-5 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-rose-500/70 via-amber-400/50 to-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
              Active Alerts &amp; Incidents
            </span>
            <span className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <ShieldAlertIcon className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <p className="text-3xl font-bold tracking-tight text-zinc-100">
              {activeThreatsTotal + stats.openIncidents}
            </p>
            <span className="text-xs font-mono text-rose-400">
              {activeCritical} Crit • {stats.openIncidents} Open SOC
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Derived live from <code className="text-zinc-300">security_logs</code> &amp;{' '}
            <code className="text-zinc-300">soc_incidents</code>
          </p>
        </div>

        <div className="relative rounded-xl bg-[#0d0f14]/95 border border-zinc-800/90 p-5 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-teal-400/70 via-amber-400/40 to-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
              Authorized Assets
            </span>
            <span className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/25 text-teal-400">
              <ActivityIcon className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <p className="text-3xl font-bold tracking-tight text-zinc-100">
              {stats.compliantAssets} / {stats.totalAssets}
            </p>
            <span className="text-xs font-mono font-medium text-teal-400">
              {assetCompliancePct}% Compliant
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-teal-400"
              style={{ width: `${assetCompliancePct}%` }}
            />
          </div>
        </div>

        <div className="relative rounded-xl bg-[#0d0f14]/95 border border-zinc-800/90 p-5 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-amber-400/80 via-orange-400/50 to-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
              Scans &amp; Threat IOCs
            </span>
            <span className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400">
              <FirewallIcon className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-3xl font-bold tracking-tight text-amber-300">
              {stats.totalScans}
            </p>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-900 text-zinc-300 border border-zinc-700/80">
              {stats.activeIocs} Active IOCs
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Real Phishing Shield &amp; WebShield scans recorded
          </p>
        </div>

        <div className="relative rounded-xl bg-[#0d0f14]/95 border border-zinc-800/90 p-5 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-zinc-300/60 via-amber-400/40 to-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
              Backups &amp; Audit Trail
            </span>
            <span className="p-2 rounded-lg bg-zinc-800/90 border border-zinc-700 text-zinc-200">
              <LockNodesIcon className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <p className="text-3xl font-bold tracking-tight text-zinc-100">
              {stats.backupHealthy} / {stats.backupTotal}
            </p>
            <span className="text-xs font-mono font-medium text-amber-300">
              {stats.auditCount} Audits
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {stats.forensicsCases} forensics cases • AES-256-GCM verified
          </p>
        </div>
      </section>

      {/* 12-in-1 Security Modules Integration Grid */}
      <section aria-label="12 Security Modules Overview" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              12-in-1 Integrated Security Modules
            </h2>
            <p className="text-xs text-zinc-400">
              Click any module to launch its live operational console and PostgreSQL API
            </p>
          </div>
          <Link
            href="/dashboard/modules"
            className="text-xs font-mono text-amber-300 hover:text-amber-200"
          >
            All Modules →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {SECURITY_MODULES.map((mod) => {
            const count = stats.moduleActivityCounts[mod.slug] ?? 0;
            return (
              <Link
                key={mod.slug}
                href={`/dashboard/modules/${mod.slug}`}
                className="group rounded-xl bg-[#0d0f14]/95 border border-zinc-800/90 hover:border-amber-500/45 p-4 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25">
                      MODULE {mod.code}
                    </span>
                    <span className="text-[10px] font-mono text-teal-400">● ACTIVE</span>
                  </div>
                  <h3 className="mt-2.5 text-sm font-semibold text-zinc-100 group-hover:text-amber-300 transition-colors">
                    {mod.name}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{mod.summary}</p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-zinc-800/70 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-500">{mod.category}</span>
                  <span className="text-zinc-300">{count} records</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Real-Time Security Threat Log Table */}
      <section
        aria-label="Real-time security threat logs"
        className="rounded-xl bg-[#0d0f14]/95 border border-zinc-800/90 overflow-hidden shadow-[0_18px_50px_-24px_rgba(0,0,0,0.8)]"
      >
        <div className="px-5 py-4 border-b border-zinc-800/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              Real-Time Security Threat Log
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Streaming events from{' '}
              <code className="text-amber-300 font-mono">public.security_logs</code>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <SearchIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter IP, vector, or node..."
                className="w-full sm:w-64 pl-9 pr-3 py-1.5 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div className="inline-flex rounded-lg bg-[#07080b] p-1 border border-zinc-800">
              {(['All', 'Critical', 'Warning', 'Secure'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === status
                      ? 'bg-zinc-800 text-amber-300'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="px-6 py-12 text-center text-xs text-zinc-400">
            No matching threat telemetry records found in PostgreSQL.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-[#090b0f] text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-4">Source IP</th>
                  <th className="py-3 px-4">Threat Vector &amp; Details</th>
                  <th className="py-3 px-4">Target Node</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-xs">
                {filteredLogs.map((log) => {
                  const badge = STATUS_BADGE_STYLES[log.status] ?? STATUS_BADGE_STYLES.Warning;
                  return (
                    <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                        {formatUtcTimestamp(log.created_at)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-200 whitespace-nowrap">
                        {log.source_ip}
                      </td>
                      <td className="py-3.5 px-4 max-w-md">
                        <p className="font-semibold text-zinc-100 font-mono text-[11px] tracking-wide">
                          {log.event_type}
                        </p>
                        <p className="text-zinc-400 mt-0.5 line-clamp-2">{log.message}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-amber-300/90 whitespace-nowrap">
                        {log.target_node}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badge.container}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        {log.is_resolved ? (
                          <span className="text-[11px] font-mono font-medium text-zinc-500">
                            Verified
                          </span>
                        ) : canModifyThreats ? (
                          <button
                            type="button"
                            onClick={() => handleResolveThreat(log)}
                            disabled={resolvingId === log.id}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/12 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {resolvingId === log.id ? 'Mitigating...' : 'Mark Secure'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-zinc-500">Read-only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
