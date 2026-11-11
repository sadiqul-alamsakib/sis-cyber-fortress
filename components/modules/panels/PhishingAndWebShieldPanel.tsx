'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type {
  AuthorizedAsset,
  ModuleSlug,
  PhishingScan,
  WebShieldScan,
} from '@/types/security';

export default function PhishingAndWebShieldPanel({ slug }: { slug: ModuleSlug }) {
  const isWebShield = slug === '07-webshield';

  // Phishing state
  const [urlInput, setUrlInput] = useState('');
  const [reportThreat, setReportThreat] = useState(false);
  const [phishingScans, setPhishingScans] = useState<PhishingScan[]>([]);

  // WebShield state
  const [authorizedWebsites, setAuthorizedWebsites] = useState<AuthorizedAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [webScans, setWebScans] = useState<WebShieldScan[]>([]);

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (isWebShield) {
      const [assetsRes, scansRes] = await Promise.all([
        fetch('/api/assets'),
        fetch('/api/modules/webshield-scan'),
      ]);
      if (assetsRes.ok) {
        const j = (await assetsRes.json()) as { assets?: AuthorizedAsset[] };
        const sites = (j.assets ?? []).filter(
          (a) => a.asset_type === 'website' && a.is_authorized
        );
        setAuthorizedWebsites(sites);
        if (sites.length > 0 && !selectedAssetId) {
          setSelectedAssetId(sites[0].id);
        }
      }
      if (scansRes.ok) {
        const j = (await scansRes.json()) as { scans?: WebShieldScan[] };
        setWebScans(j.scans ?? []);
      }
    } else {
      const res = await fetch('/api/modules/phishing-scan');
      if (res.ok) {
        const j = (await res.json()) as { scans?: PhishingScan[] };
        setPhishingScans(j.scans ?? []);
      }
    }
  }, [isWebShield, selectedAssetId]);

  useEffect(() => {
    let active = true;
    if (isWebShield) {
      Promise.all([
        fetch('/api/assets').then((r) =>
          r.ok ? (r.json() as Promise<{ assets?: AuthorizedAsset[] }>) : null
        ),
        fetch('/api/modules/webshield-scan').then((r) =>
          r.ok ? (r.json() as Promise<{ scans?: WebShieldScan[] }>) : null
        ),
      ]).then(([assetsJson, scansJson]) => {
        if (!active) return;
        if (assetsJson) {
          const sites = (assetsJson.assets ?? []).filter(
            (a) => a.asset_type === 'website' && a.is_authorized
          );
          setAuthorizedWebsites(sites);
          if (sites.length > 0) {
            setSelectedAssetId((prev) => prev || sites[0].id);
          }
        }
        if (scansJson) {
          setWebScans(scansJson.scans ?? []);
        }
      });
    } else {
      fetch('/api/modules/phishing-scan')
        .then((r) => (r.ok ? (r.json() as Promise<{ scans?: PhishingScan[] }>) : null))
        .then((j) => {
          if (active && j) setPhishingScans(j.scans ?? []);
        });
    }
    return () => {
      active = false;
    };
  }, [isWebShield]);

  const handlePhishingScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setError(null);
    setScanning(true);
    try {
      const res = await fetch('/api/modules/phishing-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim(), reportThreat }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? 'Scan failed.');
      } else {
        setUrlInput('');
        setReportThreat(false);
        await loadData();
      }
    } finally {
      setScanning(false);
    }
  };

  const handleWebShieldScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) return;
    setError(null);
    setScanning(true);
    try {
      const res = await fetch('/api/modules/webshield-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: selectedAssetId }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? 'Authorized scan failed.');
      } else {
        await loadData();
      }
    } finally {
      setScanning(false);
    }
  };

  if (isWebShield) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Authorized Website TLS, DNS &amp; Security Header Scanner
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Per ethical scope rules, scans only websites registered in Authorized Assets.
              </p>
            </div>
            <Link
              href="/dashboard/assets"
              className="text-xs font-mono text-amber-300 hover:text-amber-200"
            >
              + Register Authorized Website →
            </Link>
          </div>

          {error && (
            <p className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/35 text-xs text-rose-300">
              {error}
            </p>
          )}

          <form onSubmit={handleWebShieldScan} className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100"
            >
              {authorizedWebsites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.identifier})
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={scanning || !selectedAssetId}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 cursor-pointer"
            >
              {scanning ? 'Inspecting TLS & Headers...' : 'Run Live WebShield Scan'}
            </button>
          </form>
        </div>

        <div className="space-y-4">
          {webScans.length === 0 ? (
            <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-8 text-center text-xs text-zinc-500">
              No live WebShield scans executed yet. Select an authorized asset above and run a live TLS + HTTP header inspection.
            </div>
          ) : (
            webScans.map((scan) => (
              <div
                key={scan.id}
                className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-mono font-semibold text-amber-300">
                      {scan.target_url}
                    </p>
                    <p className="text-[11px] font-mono text-zinc-400">
                      HTTP {scan.http_status ?? 'N/A'} • TLS:{' '}
                      {scan.tls_valid ? `Valid (${scan.tls_issuer ?? 'CA'})` : 'Invalid/Unavailable'}{' '}
                      • A Records: {scan.dns_records?.a?.join(', ') || 'None'}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                      scan.security_score >= 75
                        ? 'bg-teal-500/12 text-teal-300 border-teal-500/35'
                        : scan.security_score >= 50
                        ? 'bg-amber-500/12 text-amber-300 border-amber-500/35'
                        : 'bg-rose-500/12 text-rose-400 border-rose-500/35'
                    }`}
                  >
                    SCORE: {scan.security_score}/100
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {Object.entries(scan.headers_report ?? {}).map(([header, info]) => (
                    <div
                      key={header}
                      className={`p-2 rounded-lg border text-[11px] font-mono ${
                        info.present
                          ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <p className="truncate">{header}</p>
                      <p className="font-bold mt-0.5">{info.present ? 'PRESENT' : 'MISSING'}</p>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-zinc-300 space-y-1">
                  <p className="text-[11px] font-mono uppercase text-zinc-500">Remediations:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-zinc-400">
                    {(scan.remediations ?? []).map((rem, i) => (
                      <li key={i}>{rem}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">
            Live Phishing URL Scanner &amp; IOC Reputation Check
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Inspects URL heuristics, punycode/IDN spoofing, live DNS resolution, and Threat Intelligence IOCs.
          </p>
        </div>

        {error && (
          <p className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/35 text-xs text-rose-300">
            {error}
          </p>
        )}

        <form onSubmit={handlePhishingScan} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://login-verify-secure-update.xyz/auth"
              className="flex-1 px-3 py-2 rounded-lg text-xs bg-[#07080b] border border-zinc-800 text-zinc-100 placeholder-zinc-500"
            />
            <button
              type="submit"
              disabled={scanning || !urlInput.trim()}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 cursor-pointer"
            >
              {scanning ? 'Scanning URL...' : 'Scan URL'}
            </button>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={reportThreat}
              onChange={(e) => setReportThreat(e.target.checked)}
              className="accent-amber-400"
            />
            Submit threat report to central SOC log if suspicious
          </label>
        </form>
      </div>

      <div className="rounded-xl bg-[#0d0f14] border border-zinc-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-100">Recent Phishing Scan History</h3>
        </div>
        {phishingScans.length === 0 ? (
          <p className="p-6 text-xs text-zinc-500">No URL scans performed yet.</p>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {phishingScans.map((scan) => (
              <div key={scan.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-mono font-semibold text-zinc-100 break-all">
                    {scan.target_url}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {(scan.findings ?? []).join(' • ')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-zinc-300">{scan.risk_score}/100</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold uppercase border ${
                      scan.verdict === 'malicious'
                        ? 'bg-rose-500/12 text-rose-400 border-rose-500/35'
                        : scan.verdict === 'suspicious'
                        ? 'bg-amber-500/12 text-amber-300 border-amber-500/35'
                        : 'bg-teal-500/12 text-teal-300 border-teal-500/35'
                    }`}
                  >
                    {scan.verdict}
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
