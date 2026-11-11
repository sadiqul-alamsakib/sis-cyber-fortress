'use client';

import React from 'react';

export interface AnalyticsSummary {
  generatedAt: string;
  severityBreakdown: { label: string; count: number; color: string }[];
  moduleMetrics: { module: string; count: number }[];
  phishingVerdicts: { safe: number; suspicious: number; malicious: number };
  avgWebShieldScore: number | null;
}

export default function ReportsClient({ summary }: { summary: AnalyticsSummary }) {
  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(summary, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sis-cyber-fortress-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxModuleCount = Math.max(1, ...summary.moduleMetrics.map((m) => m.count));

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Live PostgreSQL Analytics &amp; Executive Report
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Computed directly from real scan, incident, asset, and audit records (no synthetic stats).
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadJson}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer"
        >
          Export Live JSON Report ↓
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-100">
            Threat Log Severity Distribution
          </h3>
          <div className="space-y-3">
            {summary.severityBreakdown.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-300">{item.label}</span>
                  <span className="text-zinc-100">{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{
                      width: `${Math.min(100, item.count * 20)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-zinc-800 text-xs font-mono text-zinc-400 flex flex-wrap gap-4">
            <span>Phishing Safe: {summary.phishingVerdicts.safe}</span>
            <span>Suspicious: {summary.phishingVerdicts.suspicious}</span>
            <span>Malicious: {summary.phishingVerdicts.malicious}</span>
            <span>
              Avg WebShield Score:{' '}
              {summary.avgWebShieldScore !== null ? `${summary.avgWebShieldScore}/100` : 'No scans yet'}
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-100">
            Records Volume by Subsystem
          </h3>
          <div className="space-y-2.5">
            {summary.moduleMetrics.map((m) => (
              <div key={m.module} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-300">{m.module}</span>
                  <span className="text-amber-300">{m.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-teal-400"
                    style={{ width: `${Math.round((m.count / maxModuleCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
