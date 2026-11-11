'use client';

import React, { useCallback, useEffect, useState } from 'react';

interface HealthPayload {
  status: string;
  checkedAt: string;
  dbLatencyMs: number;
  supabaseProject: string;
  counts: Record<string, number>;
}

export default function SettingsClient() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        setHealth((await res.json()) as HealthPayload);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/health')
      .then((res) => (res.ok ? (res.json() as Promise<HealthPayload>) : null))
      .then((data) => {
        if (active && data) setHealth(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Live API &amp; PostgreSQL Health Check
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real roundtrip latency &amp; table verification against Supabase project{' '}
            <code className="text-amber-300">fgblxhexydgwpltmxros</code>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void checkHealth()}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer"
        >
          {loading ? 'Pinging...' : 'Run Live Health Ping'}
        </button>
      </div>

      {health && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5">
            <p className="text-[11px] font-mono uppercase text-zinc-400">API Status</p>
            <p className="mt-2 text-2xl font-bold text-teal-400 uppercase">{health.status}</p>
            <p className="mt-1 text-xs font-mono text-zinc-500">Checked: {health.checkedAt}</p>
          </div>
          <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5">
            <p className="text-[11px] font-mono uppercase text-zinc-400">PostgreSQL Roundtrip</p>
            <p className="mt-2 text-2xl font-bold text-amber-300">{health.dbLatencyMs} ms</p>
            <p className="mt-1 text-xs font-mono text-zinc-500">10 concurrent table checks</p>
          </div>
          <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5">
            <p className="text-[11px] font-mono uppercase text-zinc-400">Security Posture</p>
            <p className="mt-2 text-lg font-bold text-zinc-100">RLS + Zero-Knowledge Vault</p>
            <p className="mt-1 text-xs font-mono text-zinc-500">No plaintext secrets stored</p>
          </div>
        </div>
      )}

      {health && (
        <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5">
          <h3 className="text-sm font-semibold text-zinc-100 mb-3">
            Live Table Row Telemetry
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(health.counts).map(([table, count]) => (
              <div
                key={table}
                className="p-3 rounded-lg bg-[#07080b] border border-zinc-800 text-xs font-mono"
              >
                <p className="text-zinc-400 truncate">{table}</p>
                <p className="text-lg font-bold text-amber-300 mt-1">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
